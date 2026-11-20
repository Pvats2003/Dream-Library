-- Phase 2: admit, renew, move seat, pause, mark as left, library setup,
-- student photos and live seat updates.
--
-- Money/seat actions are single all-or-nothing functions (PLAN.md §2.6).
-- They run as the calling user (security invoker), so every row they touch
-- still passes Row Level Security. Only receipt numbering runs with raised
-- rights, because nobody may touch the counter table directly.

-- Idempotency for admits/renewals queued on a phone with weak internet.
alter table public.subscriptions add column client_op_id uuid;
alter table public.subscriptions add constraint subscriptions_client_op_unique unique (library_id, client_op_id);

-- ---------------------------------------------------------------------------
-- Calendar helpers (mirror src/lib/dates.ts; tested in pgTAP)
-- ---------------------------------------------------------------------------
create or replace function private.add_months_on_billing_day(d date, months int, billing_day int)
returns date
language sql
immutable
set search_path = ''
as $$
  select make_date(
    extract(year from t)::int,
    extract(month from t)::int,
    least(billing_day, extract(day from (date_trunc('month', t) + interval '1 month - 1 day'))::int)
  )
  from (select date_trunc('month', d) + make_interval(months => months) as t) x;
$$;

create or replace function private.library_today(lib uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (now() at time zone l.timezone)::date from public.libraries l where l.id = lib;
$$;

-- ---------------------------------------------------------------------------
-- Receipt numbers: DL-2026-00231, sequential per library per year
-- ---------------------------------------------------------------------------
create or replace function private.next_receipt_number(lib uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  yr smallint := extract(year from private.library_today(lib))::smallint;
  prefix text;
  n integer;
begin
  if not private.is_member(lib) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  select l.receipt_prefix into prefix from public.libraries l where l.id = lib;
  insert into public.receipt_counters as rc (library_id, year, last_number)
  values (lib, yr, 1)
  on conflict (library_id, year) do update set last_number = rc.last_number + 1
  returning last_number into n;
  return prefix || '-' || yr || '-' || lpad(n::text, 5, '0');
end;
$$;

-- Insert a fee payment with its receipt number. Used by admit/renew now and
-- by the Collect inbox in phase 3.
create or replace function private.insert_payment(
  lib uuid, inv uuid, stu uuid, amount integer, pay_method public.payment_method, ref text, op uuid
)
returns public.payments
language plpgsql
set search_path = ''
as $$
declare
  row public.payments;
begin
  insert into public.payments (library_id, invoice_id, student_id, amount_paise, method, reference, receipt_number, client_op_id)
  values (lib, inv, stu, amount, pay_method, nullif(trim(ref), ''), private.next_receipt_number(lib), op)
  returning * into row;
  return row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shared: create a plan period + its invoice (+ optional first payment)
-- ---------------------------------------------------------------------------
create or replace function private.start_period(
  lib uuid,
  stu uuid,
  plan uuid,
  seat uuid,
  start_on date,
  billing_day int,
  discount integer,
  discount_note text,
  pay jsonb,
  op uuid,
  renewed_from uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  p public.plans;
  sub_id uuid;
  inv_id uuid;
  end_on date;
  next_start date;
  price integer;
  paid public.payments;
  today date := private.library_today(lib);
begin
  select * into p from public.plans where id = plan and library_id = lib and is_active;
  if p.id is null then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;

  next_start := case
    when p.duration_months is not null then private.add_months_on_billing_day(start_on, p.duration_months, billing_day)
    else start_on + p.duration_days
  end;
  end_on := next_start - 1;
  price := p.price_paise;

  insert into public.subscriptions (
    library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day,
    price_paise, discount_paise, discount_reason, status, renewed_from_id, client_op_id
  ) values (
    lib, stu, p.id, seat, p.shift_id, 'empty', start_on, end_on, billing_day,
    price, coalesce(discount, 0), nullif(trim(discount_note), ''),
    (case when start_on > today then 'upcoming' else 'active' end)::public.subscription_status,
    renewed_from, op
  ) returning id into sub_id;

  insert into public.invoices (library_id, student_id, subscription_id, amount_due_paise, due_date, period_start, period_end)
  values (lib, stu, sub_id, price - coalesce(discount, 0), start_on, start_on, end_on)
  returning id into inv_id;

  if pay is not null and coalesce((pay ->> 'amount_paise')::int, 0) > 0 then
    if (pay ->> 'amount_paise')::int > price - coalesce(discount, 0) then
      raise exception 'OVERPAYMENT' using errcode = '22023';
    end if;
    paid := private.insert_payment(lib, inv_id, stu, (pay ->> 'amount_paise')::int,
      (pay ->> 'method')::public.payment_method, pay ->> 'reference', null);
  end if;

  return jsonb_build_object(
    'subscription_id', sub_id,
    'invoice_id', inv_id,
    'start_date', start_on,
    'end_date', end_on,
    'amount_due_paise', price - coalesce(discount, 0),
    'payment_id', paid.id,
    'receipt_number', paid.receipt_number,
    'receipt_token', paid.receipt_token
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Admit a new student (or bring back someone who left) in one step
-- ---------------------------------------------------------------------------
create or replace function public.admit_student(input jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lib uuid := (input ->> 'library_id')::uuid;
  op uuid := (input ->> 'client_op_id')::uuid;
  s jsonb := input -> 'student';
  stu uuid;
  existing public.students;
  start_on date := coalesce((input ->> 'start_date')::date, private.library_today(lib));
  result jsonb;
begin
  if not private.is_member(lib) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  -- Retried from the offline queue: return what we did the first time.
  if op is not null then
    select jsonb_build_object('student_id', sub.student_id, 'subscription_id', sub.id, 'duplicate', true)
      into result
      from public.subscriptions sub where sub.library_id = lib and sub.client_op_id = op;
    if result is not null then
      return result;
    end if;
  end if;

  select * into existing from public.students
   where library_id = lib and phone = s ->> 'phone' and deleted_at is null;

  if existing.id is not null and existing.status <> 'left' then
    raise exception 'PHONE_EXISTS' using errcode = '23505', detail = existing.id::text;
  end if;

  if existing.id is not null then
    -- Coming back after leaving: same record, history kept.
    update public.students set
      name = coalesce(nullif(trim(s ->> 'name'), ''), name),
      gender = coalesce((s ->> 'gender')::public.gender, gender),
      exam_target = coalesce(nullif(trim(s ->> 'exam_target'), ''), exam_target),
      photo_path = coalesce(s ->> 'photo_path', photo_path),
      status = 'active'
    where id = existing.id;
    stu := existing.id;
  else
    insert into public.students (
      library_id, name, phone, alt_phone, gender, exam_target, address, guardian_phone,
      photo_path, id_proof_path, source, referred_by, notes, joined_on
    ) values (
      lib, trim(s ->> 'name'), s ->> 'phone', nullif(s ->> 'alt_phone', ''),
      (s ->> 'gender')::public.gender, nullif(trim(s ->> 'exam_target'), ''), nullif(trim(s ->> 'address'), ''),
      nullif(s ->> 'guardian_phone', ''), s ->> 'photo_path', s ->> 'id_proof_path',
      (s ->> 'source')::public.student_source, (s ->> 'referred_by')::uuid, nullif(trim(s ->> 'notes'), ''), start_on
    ) returning id into stu;
  end if;

  result := private.start_period(
    lib, stu, (input ->> 'plan_id')::uuid, (input ->> 'seat_id')::uuid, start_on,
    extract(day from start_on)::int,
    coalesce((input ->> 'discount_paise')::int, 0), input ->> 'discount_reason',
    input -> 'payment', op, null
  );

  if coalesce((input -> 'deposit' ->> 'amount_paise')::int, 0) > 0 then
    insert into public.deposits (library_id, student_id, amount_paise, method)
    values (lib, stu, (input -> 'deposit' ->> 'amount_paise')::int,
            coalesce((input -> 'deposit' ->> 'method')::public.payment_method, 'cash'));
  end if;

  return result || jsonb_build_object('student_id', stu, 'returning', existing.id is not null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Renew: next period right after the current one (or from today after a gap)
-- ---------------------------------------------------------------------------
create or replace function public.renew_subscription(input jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lib uuid := (input ->> 'library_id')::uuid;
  op uuid := (input ->> 'client_op_id')::uuid;
  prev public.subscriptions;
  latest_end date;
  today date;
  start_on date;
  bday int;
  result jsonb;
begin
  if not private.is_member(lib) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  if op is not null then
    select jsonb_build_object('student_id', sub.student_id, 'subscription_id', sub.id, 'duplicate', true)
      into result from public.subscriptions sub where sub.library_id = lib and sub.client_op_id = op;
    if result is not null then
      return result;
    end if;
  end if;

  today := private.library_today(lib);
  -- Continue from the student's latest live or finished plan.
  select * into prev from public.subscriptions
   where library_id = lib and student_id = (input ->> 'student_id')::uuid and status <> 'cancelled'
   order by end_date desc limit 1;

  if prev.id is not null and prev.end_date >= today - 1 then
    start_on := prev.end_date + 1;      -- no gap: keep the billing day
    bday := prev.billing_day;
  else
    start_on := coalesce((input ->> 'start_date')::date, today);
    bday := extract(day from start_on)::int;
  end if;

  update public.students set status = 'active'
   where id = (input ->> 'student_id')::uuid and library_id = lib and status = 'left';

  result := private.start_period(
    lib, (input ->> 'student_id')::uuid,
    coalesce((input ->> 'plan_id')::uuid, prev.plan_id),
    case when input ? 'seat_id' then (input ->> 'seat_id')::uuid else prev.seat_id end,
    start_on, bday,
    coalesce((input ->> 'discount_paise')::int, 0), input ->> 'discount_reason',
    input -> 'payment', op, prev.id
  );
  return result || jsonb_build_object('student_id', (input ->> 'student_id')::uuid);
end;
$$;

-- ---------------------------------------------------------------------------
-- Seats: move and vacate
-- ---------------------------------------------------------------------------
create or replace function public.move_seat(sub uuid, new_seat uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.subscriptions s set seat_id = new_seat
   where s.id = sub and s.status in ('upcoming', 'active', 'paused')
     and exists (select 1 from public.seats st where st.id = new_seat and st.library_id = s.library_id and st.is_active);
  if not found then
    raise exception 'SEAT_NOT_AVAILABLE' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.vacate_seat(sub uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.subscriptions set seat_id = null where id = sub;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pause (exams, travel): the plan end date moves out by the paused days
-- ---------------------------------------------------------------------------
create or replace function public.pause_subscription(sub uuid, days int, reason text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.subscriptions;
  today date;
begin
  if days < 1 or days > 120 then
    raise exception 'BAD_DAYS' using errcode = '22023';
  end if;
  select * into s from public.subscriptions where id = sub and status = 'active';
  if s.id is null then
    raise exception 'NOT_ACTIVE' using errcode = 'P0002';
  end if;
  today := private.library_today(s.library_id);
  insert into public.subscription_pauses (library_id, subscription_id, from_date, to_date, reason)
  values (s.library_id, s.id, today, today + days - 1, nullif(trim(reason), ''));
  update public.subscriptions set status = 'paused', end_date = end_date + days where id = s.id;
  update public.students set status = 'paused' where id = s.student_id;
  return jsonb_build_object('end_date', s.end_date + days, 'resume_on', today + days);
end;
$$;

-- Resume early: give back the unused pause days.
create or replace function public.resume_subscription(sub uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  s public.subscriptions;
  p public.subscription_pauses;
  today date;
  unused int := 0;
begin
  select * into s from public.subscriptions where id = sub and status = 'paused';
  if s.id is null then
    raise exception 'NOT_PAUSED' using errcode = 'P0002';
  end if;
  today := private.library_today(s.library_id);
  select * into p from public.subscription_pauses where subscription_id = s.id order by to_date desc limit 1;
  if p.id is not null and p.to_date >= today then
    unused := p.to_date - today + 1;
    update public.subscription_pauses set to_date = today - 1 where id = p.id and from_date <= today - 1;
    delete from public.subscription_pauses where id = p.id and from_date > today - 1;
  end if;
  update public.subscriptions set status = 'active', end_date = end_date - unused where id = s.id;
  update public.students set status = 'active' where id = s.student_id;
  return jsonb_build_object('end_date', s.end_date - unused);
end;
$$;

-- ---------------------------------------------------------------------------
-- Mark as left: free the seat, settle the deposit, keep all history
-- ---------------------------------------------------------------------------
create or replace function public.mark_left(stu uuid, deposit_action text, note text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  st public.students;
  today date;
begin
  select * into st from public.students where id = stu and deleted_at is null;
  if st.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.has_perm(st.library_id, 'can_delete') then
    raise exception 'NO_PERMISSION' using errcode = '42501';
  end if;
  today := private.library_today(st.library_id);

  -- Finished today: the seat is free from tomorrow; future plans are cancelled.
  update public.subscriptions set status = 'expired', end_date = greatest(start_date, least(end_date, today))
   where student_id = stu and status in ('active', 'paused') and start_date <= today;
  update public.subscriptions set status = 'cancelled', cancelled_at = now()
   where student_id = stu and status = 'upcoming';
  -- Unpaid future fees no longer apply.
  update public.invoices set status = 'waived', waived_reason = 'left'
   where student_id = stu and status = 'due' and due_date > today;

  if deposit_action in ('refunded', 'adjusted') then
    update public.deposits set status = deposit_action::public.deposit_status, settled_at = now(),
           settled_note = nullif(trim(note), '')
     where student_id = stu and status = 'held';
  end if;

  update public.students set status = 'left',
         notes = case when nullif(trim(note), '') is null then notes
                      else concat_ws(E'\n', notes, trim(note)) end
   where id = stu;
end;
$$;

-- ---------------------------------------------------------------------------
-- New library (onboarding): the creator becomes its owner
-- ---------------------------------------------------------------------------
create or replace function public.create_library(lib_name text, lib_city text, owner_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  phone text;
  base text;
  lib uuid;
begin
  if uid is null then
    raise exception 'NOT_LOGGED_IN' using errcode = '42501';
  end if;
  if length(trim(coalesce(lib_name, ''))) = 0 then
    raise exception 'NAME_REQUIRED' using errcode = '22023';
  end if;
  select '+' || ltrim(u.phone, '+') into phone from auth.users u where u.id = uid;
  if phone is null then
    raise exception 'PHONE_REQUIRED' using errcode = '22023';
  end if;

  base := trim(both '-' from regexp_replace(lower(lib_name), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'library'; end if;

  insert into public.libraries (name, slug, city, receipt_prefix, settings)
  values (
    trim(lib_name),
    base || '-' || substr(md5(gen_random_uuid()::text), 1, 5),
    nullif(trim(lib_city), ''),
    coalesce(nullif(upper(left(regexp_replace(lib_name, '[^A-Za-z]', '', 'g'), 2)), ''), 'RC'),
    jsonb_build_object('deposit_paise', 50000, 'late_fee_per_day_paise', 0, 'reminder_days', jsonb_build_array(7, 3, 1))
  ) returning id into lib;

  insert into public.memberships (library_id, user_id, phone, display_name, role)
  values (lib, uid, phone, coalesce(nullif(trim(owner_name), ''), 'Owner'), 'owner');

  return lib;
end;
$$;

-- Seat layout from the setup wizard. Seats keep their id when the label
-- stays the same; removed seats are deleted, or closed if they have history.
create or replace function public.save_layout(lib uuid, layout jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  z jsonb;
  st jsonb;
  zone_id uuid;
  zi int := 0;
  keep text[] := '{}';
begin
  if not private.has_perm(lib, 'can_edit_settings') then
    raise exception 'NO_PERMISSION' using errcode = '42501';
  end if;

  for z in select * from jsonb_array_elements(layout) loop
    zi := zi + 1;
    insert into public.zones (library_id, name, sort_order, attributes)
    values (lib, trim(z ->> 'name'), zi, coalesce(z -> 'attributes', '{}'::jsonb))
    on conflict (library_id, name) do update set sort_order = excluded.sort_order, attributes = excluded.attributes
    returning id into zone_id;

    for st in select * from jsonb_array_elements(z -> 'seats') loop
      keep := keep || (st ->> 'label');
      insert into public.seats (library_id, zone_id, label, x, y, tags, is_active)
      values (lib, zone_id, st ->> 'label', (st ->> 'x')::smallint, (st ->> 'y')::smallint,
              coalesce((select array_agg(t) from jsonb_array_elements_text(st -> 'tags') t), '{}'), true)
      on conflict (library_id, label) do update
        set zone_id = excluded.zone_id, x = excluded.x, y = excluded.y, tags = excluded.tags, is_active = true;
    end loop;
  end loop;

  update public.seats s set is_active = false
   where s.library_id = lib and not (s.label = any(keep))
     and exists (select 1 from public.subscriptions sub where sub.seat_id = s.id);
  delete from public.seats s
   where s.library_id = lib and not (s.label = any(keep))
     and not exists (select 1 from public.subscriptions sub where sub.seat_id = s.id);
  delete from public.zones zz
   where zz.library_id = lib and not exists (select 1 from public.seats s where s.zone_id = zz.id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Student photos and ID proofs: private bucket, folder per library
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('student-files', 'student-files', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy student_files_read on storage.objects for select to authenticated
  using (bucket_id = 'student-files' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy student_files_write on storage.objects for insert to authenticated
  with check (bucket_id = 'student-files' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy student_files_update on storage.objects for update to authenticated
  using (bucket_id = 'student-files' and private.is_member(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------------------
-- Live seat map: the owner's screen updates when the desk admits someone
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.subscriptions;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff invites: linking a new staff member to an existing login reads
-- auth.users, which owners can't see directly. Run that one lookup with
-- raised rights (it only ever matches on the exact phone being added).
-- ---------------------------------------------------------------------------
alter function private.membership_defaults() security definer;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'admit_student(jsonb)', 'renew_subscription(jsonb)', 'move_seat(uuid, uuid)', 'vacate_seat(uuid)',
    'pause_subscription(uuid, int, text)', 'resume_subscription(uuid)', 'mark_left(uuid, text, text)',
    'create_library(text, text, text)', 'save_layout(uuid, jsonb)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;

-- Students fill in their own details from a QR/link; staff approve.
-- Also: fees paid before the library started using the app ("opening"
-- amounts) count towards a student's dues but never towards earnings.

-- ---------------------------------------------------------------------------
-- Opening balances on invoices
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column opening_paid_paise integer not null default 0 check (opening_paid_paise >= 0);

comment on column public.invoices.opening_paid_paise is
  'Paid before the library used LibraryOS. Included in amount_paid_paise, never in payments or earnings.';

create or replace function private.refresh_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid integer;
begin
  select i.opening_paid_paise + coalesce((select sum(p.amount_paise) from public.payments p where p.invoice_id = i.id), 0)
    into paid
    from public.invoices i where i.id = new.invoice_id;

  update public.invoices i
     set amount_paid_paise = paid,
         status = case
           when i.status = 'waived' then 'waived'
           when paid >= i.amount_due_paise then 'paid'
           when paid > 0 then 'partial'
           else 'due'
         end::public.invoice_status
   where i.id = new.invoice_id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Join link
-- ---------------------------------------------------------------------------
alter table public.libraries add column join_code text unique;
update public.libraries set join_code = substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10) where join_code is null;
alter table public.libraries alter column join_code set default substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10);
alter table public.libraries alter column join_code set not null;

create type public.join_request_status as enum ('pending', 'approved', 'rejected');

create table public.join_requests (
  id            uuid primary key default gen_random_uuid(),
  library_id    uuid not null references public.libraries (id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 80),
  phone         text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  gender        public.gender,
  shift_id      uuid,
  seat_label    text check (seat_label is null or length(seat_label) <= 12),
  last_paid_on  date,
  exam_target   text check (exam_target is null or length(exam_target) <= 60),
  source        text not null default 'form' check (source in ('form', 'manual')),
  status        public.join_request_status not null default 'pending',
  student_id    uuid references public.students (id) on delete set null,
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  foreign key (shift_id, library_id) references public.shifts (id, library_id) on delete set null (shift_id)
);
create index join_requests_pending_idx on public.join_requests (library_id, created_at) where status = 'pending';
create index join_requests_phone_idx on public.join_requests (library_id, phone);

create trigger touch_updated_at before update on public.join_requests
  for each row execute function private.touch_updated_at();

alter table public.join_requests enable row level security;
create policy join_requests_select on public.join_requests for select to authenticated
  using ((select private.is_member(library_id)));
create policy join_requests_update on public.join_requests for update to authenticated
  using ((select private.is_member(library_id)))
  with check ((select private.is_member(library_id)));
create policy join_requests_delete on public.join_requests for delete to authenticated
  using ((select private.has_perm(library_id, 'can_delete')));
grant select, update, delete on public.join_requests to authenticated;
revoke all on public.join_requests from anon;

-- ---------------------------------------------------------------------------
-- Public side (no login): read the form, send a request
-- ---------------------------------------------------------------------------
create or replace function public.get_join_form(code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'library_name', l.name,
    'city', l.city,
    'shifts', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'start_min', s.start_min, 'end_min', s.end_min, 'is_full_day', s.is_full_day)
                       order by s.sort_order)
      from public.shifts s where s.library_id = l.id and s.is_active), '[]'::jsonb)
  )
  from public.libraries l
  where l.join_code = lower(trim(code));
$$;

-- Never reveals whether someone is already a student (privacy): every valid
-- request gets the same answer.
create or replace function public.submit_join_request(code text, input jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  lib uuid;
  today date;
  ph text := input ->> 'phone';
  nm text := trim(coalesce(input ->> 'name', ''));
  sh uuid := nullif(input ->> 'shift_id', '')::uuid;
  paid date := nullif(input ->> 'last_paid_on', '')::date;
  existing uuid;
begin
  select l.id into lib from public.libraries l where l.join_code = lower(trim(code));
  if lib is null then
    raise exception 'BAD_LINK' using errcode = 'P0002';
  end if;
  if length(nm) not between 1 and 80 or ph is null or ph !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'INVALID' using errcode = '22023';
  end if;
  if sh is not null and not exists (select 1 from public.shifts s where s.id = sh and s.library_id = lib) then
    sh := null;
  end if;
  today := private.library_today(lib);
  if paid is not null and (paid > today or paid < today - 400) then
    paid := null;
  end if;

  -- Limits against spam: 5 sends per number per day, 500 waiting per library.
  if (select count(*) from public.join_requests r
       where r.library_id = lib and r.phone = ph and r.created_at > now() - interval '1 day') >= 5
     or (select count(*) from public.join_requests r where r.library_id = lib and r.status = 'pending') >= 500 then
    raise exception 'TOO_MANY' using errcode = '54000';
  end if;

  -- Sending again replaces their earlier waiting request.
  select r.id into existing from public.join_requests r
   where r.library_id = lib and r.phone = ph and r.status = 'pending'
   order by r.created_at desc limit 1;

  if existing is not null then
    update public.join_requests set
      name = nm,
      gender = nullif(input ->> 'gender', '')::public.gender,
      shift_id = sh,
      seat_label = nullif(upper(trim(coalesce(input ->> 'seat_label', ''))), ''),
      last_paid_on = paid,
      exam_target = nullif(trim(coalesce(input ->> 'exam_target', '')), '')
    where id = existing;
  else
    insert into public.join_requests (library_id, name, phone, gender, shift_id, seat_label, last_paid_on, exam_target)
    values (lib, nm, ph, nullif(input ->> 'gender', '')::public.gender, sh,
            nullif(upper(trim(coalesce(input ->> 'seat_label', ''))), ''), paid,
            nullif(trim(coalesce(input ->> 'exam_target', '')), ''));
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff side: add an existing student (from a request or typed by hand)
-- ---------------------------------------------------------------------------
-- input: name, phone, gender, exam_target, plan_id, seat_id, start_date
-- (when their current period began = the day they last paid), pending_paise
-- (fees still owed for that period), request_id (optional).
create or replace function public.import_student(input jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lib uuid := (input ->> 'library_id')::uuid;
  req uuid := nullif(input ->> 'request_id', '')::uuid;
  p public.plans;
  stu uuid;
  sub uuid;
  start_on date := (input ->> 'start_date')::date;
  next_start date;
  end_on date;
  today date;
  pending integer := greatest(0, coalesce((input ->> 'pending_paise')::int, 0));
  st public.subscription_status;
begin
  if not private.is_member(lib) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  if req is not null and not exists (
    select 1 from public.join_requests r where r.id = req and r.library_id = lib and r.status = 'pending' for update
  ) then
    raise exception 'REQUEST_DONE' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.students s where s.library_id = lib and s.phone = input ->> 'phone' and s.deleted_at is null) then
    raise exception 'PHONE_EXISTS' using errcode = '23505';
  end if;
  select * into p from public.plans where id = (input ->> 'plan_id')::uuid and library_id = lib;
  if p.id is null then
    raise exception 'PLAN_NOT_FOUND' using errcode = 'P0002';
  end if;
  if pending > p.price_paise then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;

  today := private.library_today(lib);
  next_start := case when p.duration_months is not null
                     then private.add_months_on_billing_day(start_on, p.duration_months, extract(day from start_on)::int)
                     else start_on + p.duration_days end;
  end_on := next_start - 1;
  st := case when end_on < today then 'expired' when start_on > today then 'upcoming' else 'active' end;

  insert into public.students (library_id, name, phone, gender, exam_target, joined_on, status, source)
  values (lib, trim(input ->> 'name'), input ->> 'phone', nullif(input ->> 'gender', '')::public.gender,
          nullif(trim(coalesce(input ->> 'exam_target', '')), ''), start_on, 'active', 'walk_in')
  returning id into stu;

  insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes,
                                    start_date, end_date, billing_day, price_paise, status)
  values (lib, stu, p.id, case when st = 'expired' then null else nullif(input ->> 'seat_id', '')::uuid end,
          p.shift_id, 'empty', start_on, end_on, extract(day from start_on)::int, p.price_paise, st)
  returning id into sub;

  -- What they paid before the app is an opening amount, not a payment today.
  insert into public.invoices (library_id, student_id, subscription_id, amount_due_paise, opening_paid_paise,
                               amount_paid_paise, due_date, period_start, period_end, status, note)
  values (lib, stu, sub, p.price_paise, p.price_paise - pending, p.price_paise - pending, start_on, start_on, end_on,
          (case when pending = 0 then 'paid' when pending < p.price_paise then 'partial' else 'due' end)::public.invoice_status,
          'Before LibraryOS');

  if req is not null then
    update public.join_requests set status = 'approved', student_id = stu, reviewed_by = auth.uid(), reviewed_at = now()
     where id = req;
  end if;

  return jsonb_build_object('student_id', stu, 'subscription_id', sub, 'start_date', start_on, 'end_date', end_on, 'status', st);
end;
$$;

create or replace function public.reset_join_code(lib uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  code text := substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10);
begin
  if not private.has_perm(lib, 'can_edit_settings') then
    raise exception 'NO_PERMISSION' using errcode = '42501';
  end if;
  update public.libraries set join_code = code where id = lib;
  return code;
end;
$$;

-- New requests appear live on the owner's phone.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.join_requests;
  end if;
end;
$$;

create trigger log_activity after insert or update or delete on public.join_requests
  for each row execute function private.log_activity();

revoke all on function public.get_join_form(text) from public;
revoke all on function public.submit_join_request(text, jsonb) from public;
grant execute on function public.get_join_form(text) to anon, authenticated;
grant execute on function public.submit_join_request(text, jsonb) to anon, authenticated;
revoke all on function public.import_student(jsonb) from public, anon;
revoke all on function public.reset_join_code(uuid) from public, anon;
grant execute on function public.import_student(jsonb) to authenticated;
grant execute on function public.reset_join_code(uuid) to authenticated;
-- private.library_today is called by the public submit function (definer), fine;
-- anon still has no direct access to the private schema.

-- ---------------------------------------------------------------------------
-- Fix: "a library needs an owner" must not block deleting the whole library.
-- ---------------------------------------------------------------------------
create or replace function private.protect_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The library itself is being deleted: its memberships go with it.
  if tg_op = 'DELETE' and not exists (select 1 from public.libraries l where l.id = old.library_id) then
    return old;
  end if;
  if old.role = 'owner' and old.is_active
     and (tg_op = 'DELETE' or new.role <> 'owner' or not new.is_active)
     and not exists (
       select 1 from public.memberships m
       where m.library_id = old.library_id and m.id <> old.id
         and m.role = 'owner' and m.is_active)
  then
    raise exception 'LAST_OWNER' using errcode = 'P0001',
      hint = 'A library needs at least one owner.';
  end if;
  return coalesce(new, old);
end;
$$;

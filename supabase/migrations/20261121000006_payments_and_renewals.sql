-- Phase 3: collecting fees, receipts, pay links, reversals, reminders and
-- the nightly job that moves plans along and raises next month's fees.

-- ---------------------------------------------------------------------------
-- Pay link per fee: the student opens /p/<token> to pay by UPI
-- ---------------------------------------------------------------------------
alter table public.invoices
  add column pay_token text not null unique default encode(extensions.gen_random_bytes(12), 'hex');

-- ---------------------------------------------------------------------------
-- Record a payment against a fee (desk, manager, owner)
-- ---------------------------------------------------------------------------
-- input: library_id, invoice_id, amount_paise, method, reference, client_op_id
create or replace function public.record_payment(input jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lib uuid := (input ->> 'library_id')::uuid;
  op uuid := nullif(input ->> 'client_op_id', '')::uuid;
  amount integer := (input ->> 'amount_paise')::int;
  inv public.invoices;
  paid public.payments;
begin
  if not private.is_member(lib) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;

  -- Sent twice from a weak connection: return the first one.
  if op is not null then
    select * into paid from public.payments p where p.library_id = lib and p.client_op_id = op;
    if paid.id is not null then
      return jsonb_build_object('payment_id', paid.id, 'receipt_number', paid.receipt_number,
                                'receipt_token', paid.receipt_token, 'duplicate', true);
    end if;
  end if;

  select * into inv from public.invoices i
   where i.id = (input ->> 'invoice_id')::uuid and i.library_id = lib
   for update;
  if inv.id is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if inv.status in ('paid', 'waived') then
    raise exception 'ALREADY_PAID' using errcode = 'P0001';
  end if;
  if amount is null or amount <= 0 then
    raise exception 'BAD_AMOUNT' using errcode = '22023';
  end if;
  if amount > inv.amount_due_paise - inv.amount_paid_paise then
    raise exception 'OVERPAYMENT' using errcode = '22023';
  end if;

  paid := private.insert_payment(lib, inv.id, inv.student_id, amount,
    coalesce(nullif(input ->> 'method', ''), 'cash')::public.payment_method, input ->> 'reference', op);

  select * into inv from public.invoices where id = inv.id;
  return jsonb_build_object(
    'payment_id', paid.id,
    'receipt_number', paid.receipt_number,
    'receipt_token', paid.receipt_token,
    'invoice_status', inv.status,
    'still_owed_paise', inv.amount_due_paise - inv.amount_paid_paise
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments are never edited: a mistake is undone by a reversal with a reason
-- ---------------------------------------------------------------------------
create or replace function public.reverse_payment(payment uuid, reason text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  p public.payments;
  rev public.payments;
begin
  select * into p from public.payments where id = payment;
  if p.id is null or p.amount_paise <= 0 then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if not private.has_perm(p.library_id, 'can_delete') then
    raise exception 'NO_PERMISSION' using errcode = '42501';
  end if;
  if length(trim(coalesce(reason, ''))) = 0 then
    raise exception 'REASON_REQUIRED' using errcode = '22023';
  end if;
  if exists (select 1 from public.payments r where r.reverses_payment_id = p.id) then
    raise exception 'ALREADY_REVERSED' using errcode = 'P0001';
  end if;

  insert into public.payments (library_id, invoice_id, student_id, amount_paise, method, reverses_payment_id, reversal_reason)
  values (p.library_id, p.invoice_id, p.student_id, -p.amount_paise, p.method, p.id, trim(reason))
  returning * into rev;
  return jsonb_build_object('reversal_id', rev.id);
end;
$$;

-- The invoice must follow reversals too (amount goes back to owed).
-- refresh_invoice_paid already sums all payments incl. negatives; make sure
-- a reversal re-opens a paid invoice.
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
-- One-tap renewal from the Fees list: same plan, same seat, next period.
-- (renew_subscription already exists; this is a thin, safer wrapper that
-- keeps the seat only if it is still free for the new dates.)
-- ---------------------------------------------------------------------------
create or replace function public.quick_renew(stu uuid, op uuid)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  lib uuid;
  res jsonb;
begin
  select s.library_id into lib from public.students s where s.id = stu;
  if lib is null then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  begin
    res := public.renew_subscription(jsonb_build_object('library_id', lib, 'student_id', stu, 'client_op_id', op));
  exception when exclusion_violation then
    -- Their seat was given to someone else for the next period: renew without a seat.
    res := public.renew_subscription(jsonb_build_object('library_id', lib, 'student_id', stu, 'client_op_id', op, 'seat_id', null))
           || jsonb_build_object('seat_lost', true);
  end;
  return res;
end;
$$;

-- ---------------------------------------------------------------------------
-- Public pages (no login): pay link and receipt. They reveal only what is
-- printed on a receipt; never the full phone number.
-- ---------------------------------------------------------------------------
create or replace function public.get_pay_info(token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'library_name', l.name,
    'city', l.city,
    'upi_id', l.upi_id,
    'whatsapp_number', l.whatsapp_number,
    'student_name', split_part(s.name, ' ', 1),
    'owed_paise', i.amount_due_paise - i.amount_paid_paise,
    'status', i.status,
    'due_date', i.due_date,
    'period_start', i.period_start,
    'period_end', i.period_end,
    'plan_name', p.name
  )
  from public.invoices i
  join public.libraries l on l.id = i.library_id
  join public.students s on s.id = i.student_id
  left join public.subscriptions sub on sub.id = i.subscription_id
  left join public.plans p on p.id = sub.plan_id
  where i.pay_token = token;
$$;

create or replace function public.get_receipt(token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'library_name', l.name,
    'city', l.city,
    'address', l.address,
    'whatsapp_number', l.whatsapp_number,
    'brand_color', l.brand_color,
    'receipt_number', p.receipt_number,
    'amount_paise', p.amount_paise,
    'method', p.method,
    'reference', p.reference,
    'received_at', p.received_at,
    'timezone', l.timezone,
    'student_name', s.name,
    'phone_last4', right(s.phone, 4),
    'plan_name', pl.name,
    'period_start', i.period_start,
    'period_end', i.period_end,
    'seat_label', se.label,
    'invoice_due_paise', i.amount_due_paise,
    'invoice_paid_paise', i.amount_paid_paise,
    'received_by', (select m.display_name from public.memberships m where m.library_id = l.id and m.user_id = p.received_by limit 1),
    'reversed', exists (select 1 from public.payments r where r.reverses_payment_id = p.id)
  )
  from public.payments p
  join public.libraries l on l.id = p.library_id
  join public.invoices i on i.id = p.invoice_id
  join public.students s on s.id = p.student_id
  left join public.subscriptions sub on sub.id = i.subscription_id
  left join public.plans pl on pl.id = sub.plan_id
  left join public.seats se on se.id = sub.seat_id
  where p.receipt_token = token and p.amount_paise > 0;
$$;

-- ---------------------------------------------------------------------------
-- Nightly: move plans along and raise next period's fee before it is due
-- ---------------------------------------------------------------------------
create or replace function private.nightly(only_library uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  s record;
  today date;
  renew_days int;
  renewed int := 0;
  expired int := 0;
  activated int := 0;
  resumed int := 0;
begin
  for l in select id, timezone, settings from public.libraries where only_library is null or id = only_library loop
    today := (now() at time zone l.timezone)::date;
    renew_days := coalesce((l.settings ->> 'renew_days_before')::int, 3);

    -- Pauses that have run out.
    with r as (
      update public.subscriptions sub set status = 'active'
       where sub.library_id = l.id and sub.status = 'paused'
         and not exists (select 1 from public.subscription_pauses p where p.subscription_id = sub.id and p.to_date >= today)
      returning sub.student_id)
    update public.students st set status = 'active' from r where st.id = r.student_id and st.status = 'paused';
    get diagnostics resumed = row_count;

    -- Plans that ended yesterday or earlier.
    update public.subscriptions set status = 'expired'
     where library_id = l.id and status = 'active' and end_date < today;
    get diagnostics expired = row_count;

    -- Next periods that start today.
    update public.subscriptions set status = 'active'
     where library_id = l.id and status = 'upcoming' and start_date <= today;
    get diagnostics activated = row_count;

    -- Raise next period's fee a few days before the plan ends (same plan,
    -- same seat if it is still free). Students who left, paused or whose
    -- plan is set not to renew are skipped.
    for s in
      select sub.*
        from public.subscriptions sub
        join public.students st on st.id = sub.student_id and st.status = 'active' and st.deleted_at is null
       where sub.library_id = l.id and sub.status = 'active' and sub.auto_renew
         and sub.end_date between today and today + renew_days
         and not exists (
           select 1 from public.subscriptions nxt
            where nxt.student_id = sub.student_id and nxt.start_date > sub.end_date and nxt.status in ('upcoming', 'active'))
    loop
      begin
        perform private.start_period(l.id, s.student_id, s.plan_id, s.seat_id, s.end_date + 1, s.billing_day,
                                     0, null, null, null, s.id);
      exception when exclusion_violation then
        perform private.start_period(l.id, s.student_id, s.plan_id, null, s.end_date + 1, s.billing_day,
                                     0, null, null, null, s.id);
      end;
      renewed := renewed + 1;
    end loop;
  end loop;
  return jsonb_build_object('renewed', renewed, 'expired', expired, 'activated', activated, 'resumed', resumed);
end;
$$;

-- 00:05 IST every night.
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'libraryos-nightly') then
    perform cron.unschedule('libraryos-nightly');
  end if;
  perform cron.schedule('libraryos-nightly', '35 18 * * *', 'select private.nightly()');
end;
$$;

-- ---------------------------------------------------------------------------
-- Reminder log: who reminded whom, when, with what text
-- ---------------------------------------------------------------------------
-- (table exists from phase 1; staff insert through RLS)

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.record_payment(jsonb) from public, anon;
revoke all on function public.reverse_payment(uuid, text) from public, anon;
revoke all on function public.quick_renew(uuid, uuid) from public, anon;
grant execute on function public.record_payment(jsonb) to authenticated;
grant execute on function public.reverse_payment(uuid, text) to authenticated;
grant execute on function public.quick_renew(uuid, uuid) to authenticated;
revoke all on function public.get_pay_info(text) from public;
revoke all on function public.get_receipt(text) from public;
grant execute on function public.get_pay_info(text) to anon, authenticated;
grant execute on function public.get_receipt(text) to anon, authenticated;
revoke all on function private.nightly(uuid) from public, anon, authenticated;

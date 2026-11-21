-- Collecting fees, reversals, public receipt/pay pages, nightly renewals.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, phone, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '918300000001', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', '918300000003', 'authenticated', 'authenticated');
insert into public.libraries (id, name, slug, receipt_prefix) values ('10000000-0000-0000-0000-00000000000a', 'Lib A', 'lib-a-p4', 'LA');
insert into public.memberships (library_id, phone, display_name, role) values
  ('10000000-0000-0000-0000-00000000000a', '+918300000001', 'Owner', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '+918300000003', 'Sonu', 'desk');
insert into public.shifts (id, library_id, name, start_min, end_min) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning', 360, 720);
insert into public.plans (id, library_id, name, shift_id, duration_months, price_paise) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning Monthly', '20000000-0000-0000-0000-000000000001', 1, 60000);
insert into public.seats (id, library_id, label) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'A1'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'A2');
insert into public.students (id, library_id, name, phone) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Rahul Kumar', '+919800000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Priya Kumari', '+919800000002');

-- Rahul's plan ends in 2 days → nightly should raise next month's fee.
insert into public.subscriptions (id, library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'empty',
   private.library_today('10000000-0000-0000-0000-00000000000a') - 27, private.library_today('10000000-0000-0000-0000-00000000000a') + 2,
   extract(day from private.library_today('10000000-0000-0000-0000-00000000000a') - 27)::int, 60000);
insert into public.invoices (id, library_id, student_id, subscription_id, amount_due_paise, due_date) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001', 60000, current_date - 27);
-- Priya's plan ended 3 days ago, still marked active.
insert into public.subscriptions (id, library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise) values
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'empty',
   current_date - 33, current_date - 3, 1, 60000);

-- ---------------------------------------------------------------- desk collects
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}', true);

create temp table p1 as select public.record_payment(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a', 'invoice_id', '70000000-0000-0000-0000-000000000001',
  'amount_paise', 20000, 'method', 'upi', 'reference', 'UPI123', 'client_op_id', '90000000-0000-0000-0000-000000000001')) as res;
select ok((select res ->> 'receipt_number' from p1) like 'LA-%-00001', 'desk records ₹200 and gets receipt LA-YYYY-00001');
select is((select res ->> 'invoice_status' from p1), 'partial', 'the fee is now part-paid');
select is((select (res ->> 'still_owed_paise')::int from p1), 40000, '₹400 still owed');

select is((public.record_payment(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a', 'invoice_id', '70000000-0000-0000-0000-000000000001',
  'amount_paise', 20000, 'method', 'upi', 'client_op_id', '90000000-0000-0000-0000-000000000001')) ->> 'duplicate'), 'true',
  'the same payment sent twice is saved once');
select is((select count(*)::int from public.payments where invoice_id = '70000000-0000-0000-0000-000000000001'), 1, 'still one payment');

select throws_ok($$ select public.record_payment(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a', 'invoice_id', '70000000-0000-0000-0000-000000000001',
  'amount_paise', 50000, 'method', 'cash')) $$, '22023', 'OVERPAYMENT', 'cannot take more than is owed');
select throws_ok($$ select public.record_payment(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a', 'invoice_id', '70000000-0000-0000-0000-000000000001',
  'amount_paise', 0, 'method', 'cash')) $$, '22023', 'BAD_AMOUNT', 'zero is not a payment');

create temp table p2 as select public.record_payment(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a', 'invoice_id', '70000000-0000-0000-0000-000000000001',
  'amount_paise', 40000, 'method', 'cash')) as res;
select is((select res ->> 'invoice_status' from p2), 'paid', 'the rest settles the fee');
select ok((select res ->> 'receipt_number' from p2) like '%-00002', 'second receipt is 00002');
select throws_ok($$ select public.record_payment(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a', 'invoice_id', '70000000-0000-0000-0000-000000000001',
  'amount_paise', 100, 'method', 'cash')) $$, 'P0001', 'ALREADY_PAID', 'a paid fee cannot be paid again');

select throws_ok(format($$ select public.reverse_payment(%L, 'wrong amount') $$, (select res ->> 'payment_id' from p2)),
  '42501', 'NO_PERMISSION', 'desk cannot reverse a payment');

-- Snooze a fee (desk can).
select lives_ok($$ update public.invoices set snoozed_until = current_date + 3 where id = '70000000-0000-0000-0000-000000000001' $$,
  'desk can snooze a fee for a few days');

-- ---------------------------------------------------------------- owner reverses
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select throws_ok(format($$ select public.reverse_payment(%L, '  ') $$, (select res ->> 'payment_id' from p2)),
  '22023', 'REASON_REQUIRED', 'a reversal needs a reason');
select lives_ok(format($$ select public.reverse_payment(%L, 'entered ₹400 by mistake') $$, (select res ->> 'payment_id' from p2)),
  'owner reverses a payment with a reason');
select is((select status::text from public.invoices where id = '70000000-0000-0000-0000-000000000001'), 'partial',
  'after the reversal the fee is part-paid again');
select throws_ok(format($$ select public.reverse_payment(%L, 'again') $$, (select res ->> 'payment_id' from p2)),
  'P0001', 'ALREADY_REVERSED', 'a payment can only be reversed once');

-- ---------------------------------------------------------------- public pages
reset role;
select set_config('t.r1', (select res ->> 'receipt_token' from p1), true);
select set_config('t.r2', (select res ->> 'receipt_token' from p2), true);
set local role anon;
select is((public.get_receipt(current_setting('t.r1')) ->> 'student_name'), 'Rahul Kumar', 'the receipt link works without login');
select is((public.get_receipt(current_setting('t.r1')) ->> 'phone_last4'), '0001', 'the receipt shows only the last 4 digits of the phone');
select is((public.get_receipt(current_setting('t.r2')) ->> 'reversed'), 'true', 'a reversed receipt says so');
select is(public.get_pay_info('nope'), null, 'a wrong pay link shows nothing');
reset role;
select is((public.get_pay_info((select pay_token from public.invoices where id = '70000000-0000-0000-0000-000000000001')) ->> 'owed_paise')::int, 40000,
  'the pay link shows what is still owed');

-- ---------------------------------------------------------------- nightly
select is((private.nightly('10000000-0000-0000-0000-00000000000a') ->> 'renewed')::int, 1, 'nightly raises next month''s fee for a plan ending soon');
select is((select status::text from public.subscriptions where id = '60000000-0000-0000-0000-000000000002'), 'expired', 'nightly expires ended plans');
select is((select count(*)::int from public.invoices where student_id = '50000000-0000-0000-0000-000000000001' and status = 'due'
             and due_date = (select end_date + 1 from public.subscriptions where id = '60000000-0000-0000-0000-000000000001')), 1,
  'the new fee is due the day after the current plan ends');

select * from finish();
rollback;

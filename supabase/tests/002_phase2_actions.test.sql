-- Admit, renew, move, pause, mark as left, receipts and library setup.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, phone, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '918100000001', 'authenticated', 'authenticated'), -- owner
  ('00000000-0000-0000-0000-0000000000a2', '918100000002', 'authenticated', 'authenticated'), -- desk
  ('00000000-0000-0000-0000-0000000000c1', '918100000009', 'authenticated', 'authenticated'); -- new owner
insert into public.libraries (id, name, slug, receipt_prefix) values ('10000000-0000-0000-0000-00000000000a', 'Lib A', 'lib-a-p2', 'LA');
insert into public.memberships (library_id, phone, display_name, role) values
  ('10000000-0000-0000-0000-00000000000a', '+918100000001', 'Owner', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '+918100000002', 'Desk', 'desk');
insert into public.shifts (id, library_id, name, start_min, end_min, is_full_day) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning', 360, 720, false),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a', 'Full Day', 360, 1380, true);
insert into public.plans (id, library_id, name, shift_id, duration_months, price_paise) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning', '20000000-0000-0000-0000-000000000001', 1, 60000),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a', 'Full', '20000000-0000-0000-0000-000000000003', 1, 120000);
insert into public.seats (id, library_id, label) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'A1'),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'A2');

-- ---------------------------------------------------------------- calendar
select is(private.add_months_on_billing_day('2027-01-31', 1, 31), '2027-02-28'::date, '31 Jan + 1 month = 28 Feb');
select is(private.add_months_on_billing_day('2027-02-28', 1, 31), '2027-03-31'::date, 'billing day 31 comes back in March');
select is(private.add_months_on_billing_day('2028-01-30', 1, 30), '2028-02-29'::date, 'leap year');
select is(private.add_months_on_billing_day('2026-11-30', 3, 30), '2027-02-28'::date, 'across the year end');

-- ---------------------------------------------------------------- as desk
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);

create temp table r as
select public.admit_student(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a',
  'client_op_id', '90000000-0000-0000-0000-000000000001',
  'student', jsonb_build_object('name', 'Rahul Kumar', 'phone', '+919800000001', 'gender', 'male', 'exam_target', 'BPSC'),
  'plan_id', '30000000-0000-0000-0000-000000000001',
  'seat_id', '40000000-0000-0000-0000-000000000001',
  'payment', jsonb_build_object('amount_paise', 20000, 'method', 'upi'),
  'deposit', jsonb_build_object('amount_paise', 50000, 'method', 'cash')
)) as res;

select ok((select res ? 'student_id' from r), 'desk can admit a student');
select is((select res ->> 'receipt_number' from r),
  'LA-' || extract(year from private.library_today('10000000-0000-0000-0000-00000000000a')) || '-00001', 'first receipt is LA-YYYY-00001');
select is((select status::text from public.invoices where id = (select (res ->> 'invoice_id')::uuid from r)), 'partial', '₹200 of ₹600 → partial');
select is((select end_date - start_date + 1 from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from r)) between 28 and 31, true, 'a monthly plan lasts one month');
select is((select count(*)::int from public.deposits where student_id = (select (res ->> 'student_id')::uuid from r)), 1, 'deposit recorded');

select is(
  (public.admit_student(jsonb_build_object(
    'library_id', '10000000-0000-0000-0000-00000000000a',
    'client_op_id', '90000000-0000-0000-0000-000000000001',
    'student', jsonb_build_object('name', 'Rahul Kumar', 'phone', '+919800000001'),
    'plan_id', '30000000-0000-0000-0000-000000000001'
  )) ->> 'duplicate'), 'true', 'retrying the same admit from the offline queue does nothing twice');

select throws_ok($$
  select public.admit_student(jsonb_build_object(
    'library_id', '10000000-0000-0000-0000-00000000000a',
    'student', jsonb_build_object('name', 'Rahul Again', 'phone', '+919800000001'),
    'plan_id', '30000000-0000-0000-0000-000000000001'))
$$, '23505', 'PHONE_EXISTS', 'the same phone number cannot be admitted twice');

select throws_ok($$
  select public.admit_student(jsonb_build_object(
    'library_id', '10000000-0000-0000-0000-00000000000a',
    'student', jsonb_build_object('name', 'Priya', 'phone', '+919800000002', 'gender', 'female'),
    'plan_id', '30000000-0000-0000-0000-000000000003',
    'seat_id', '40000000-0000-0000-0000-000000000001'))
$$, '23P01', null, 'Full Day cannot take a seat busy in the morning');
select is((select count(*)::int from public.students where phone = '+919800000002'), 0, 'a failed admit leaves nothing behind');

select throws_ok($$
  select public.admit_student(jsonb_build_object(
    'library_id', '10000000-0000-0000-0000-00000000000a',
    'student', jsonb_build_object('name', 'Aman', 'phone', '+919800000003'),
    'plan_id', '30000000-0000-0000-0000-000000000001',
    'discount_paise', 10000, 'discount_reason', 'friend'))
$$, '42501', 'NO_DISCOUNT_PERMISSION', 'desk cannot give a discount at admission');

select throws_ok($$
  select public.admit_student(jsonb_build_object(
    'library_id', '10000000-0000-0000-0000-00000000000a',
    'student', jsonb_build_object('name', 'Aman', 'phone', '+919800000003'),
    'plan_id', '30000000-0000-0000-0000-000000000001',
    'payment', jsonb_build_object('amount_paise', 99900, 'method', 'cash')))
$$, '22023', 'OVERPAYMENT', 'cannot collect more than the fee');

-- Second payment number increments.
create temp table r2 as
select public.admit_student(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a',
  'student', jsonb_build_object('name', 'Aman Raj', 'phone', '+919800000003'),
  'plan_id', '30000000-0000-0000-0000-000000000001',
  'seat_id', '40000000-0000-0000-0000-000000000002',
  'payment', jsonb_build_object('amount_paise', 60000, 'method', 'cash'))) as res;
select ok((select res ->> 'receipt_number' from r2) like '%-00002', 'receipt numbers go up one by one');
select is((select status::text from public.invoices where id = (select (res ->> 'invoice_id')::uuid from r2)), 'paid', 'full payment → paid');

-- Move Rahul to Aman's seat → clash; move to a free shift works via vacate.
select throws_ok(format($$ select public.move_seat(%L, '40000000-0000-0000-0000-000000000002') $$,
  (select res ->> 'subscription_id' from r)), '23P01', null, 'cannot move into an occupied seat');

-- Renew continues the day after the current plan ends.
create temp table rn as
select public.renew_subscription(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a',
  'student_id', (select res ->> 'student_id' from r))) as res;
select is((select (res ->> 'start_date')::date from rn),
  (select end_date + 1 from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from r)),
  'renewal starts the day after the current plan ends');
select is((select seat_id from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from rn)),
  '40000000-0000-0000-0000-000000000001'::uuid, 'renewal keeps the same seat');

-- Pause 7 days pushes the end date out by 7; resuming the same day gives them back.
create temp table before_pause as select end_date from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from r2);
select public.pause_subscription((select (res ->> 'subscription_id')::uuid from r2), 7, 'exam');
select is((select end_date from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from r2)),
  (select end_date + 7 from before_pause), 'pausing for 7 days extends the plan by 7 days');
select public.resume_subscription((select (res ->> 'subscription_id')::uuid from r2));
select is((select end_date from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from r2)),
  (select end_date from before_pause), 'resuming straight away gives the days back');

select throws_ok(format($$ select public.mark_left(%L, 'refunded', 'shifted city') $$, (select res ->> 'student_id' from r)),
  '42501', 'NO_PERMISSION', 'desk cannot mark a student as left');

-- ---------------------------------------------------------------- as owner
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select public.mark_left((select (res ->> 'student_id')::uuid from r), 'refunded', 'shifted city');
select is((select status::text from public.students where id = (select (res ->> 'student_id')::uuid from r)), 'left', 'owner marks a student as left');
select is((select status::text from public.deposits where student_id = (select (res ->> 'student_id')::uuid from r)), 'refunded', 'deposit settled');
select is((select status::text from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from rn)), 'cancelled', 'future renewal cancelled');

-- ---------------------------------------------------------------- a new owner sets up a library
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated"}', true);
create temp table nl as select public.create_library('Shanti Library', 'Bhagalpur', 'Sanjay') as id;
select is((select role::text from public.memberships where library_id = (select id from nl)), 'owner', 'creator becomes the owner');
select public.save_layout((select id from nl), '[{"name": "Hall", "seats": [{"label": "A1", "x": 0, "y": 0}, {"label": "A2", "x": 1, "y": 0}]}]'::jsonb);
select is((select count(*)::int from public.seats where library_id = (select id from nl)), 2, 'layout saved');
select is((select count(*)::int from public.students), 0, 'the new owner sees no one else''s students');

select * from finish();
rollback;

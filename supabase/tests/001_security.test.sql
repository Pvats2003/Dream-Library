-- Proves: no data leaks between libraries, role limits hold, seat clashes are
-- impossible and payments can't be changed. Runs with `npm run test:db`.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, phone, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '918000000001', 'authenticated', 'authenticated'), -- owner A
  ('00000000-0000-0000-0000-0000000000a2', '918000000002', 'authenticated', 'authenticated'), -- desk A
  ('00000000-0000-0000-0000-0000000000b1', '918000000003', 'authenticated', 'authenticated'), -- owner B
  ('00000000-0000-0000-0000-0000000000c1', '918000000004', 'authenticated', 'authenticated'); -- stranger

insert into public.libraries (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Lib A', 'lib-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Lib B', 'lib-b');

-- Desk is invited by phone before the user row exists? Here the user exists,
-- so the trigger links user_id from the phone.
insert into public.memberships (library_id, phone, display_name, role) values
  ('10000000-0000-0000-0000-00000000000a', '+918000000001', 'Owner A', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '+918000000002', 'Desk A', 'desk'),
  ('10000000-0000-0000-0000-00000000000b', '+918000000003', 'Owner B', 'owner');

insert into public.shifts (id, library_id, name, start_min, end_min, is_full_day) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning', 360, 720, false),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Evening', 720, 1080, false),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a', 'Full Day', 360, 1380, true);
insert into public.plans (id, library_id, name, shift_id, duration_months, price_paise) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning', '20000000-0000-0000-0000-000000000001', 1, 60000),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Evening', '20000000-0000-0000-0000-000000000002', 1, 60000),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a', 'Full', '20000000-0000-0000-0000-000000000003', 1, 120000);
insert into public.seats (id, library_id, label) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'A1');
insert into public.students (id, library_id, name, phone) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Rahul', '+919000000001'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Priya', '+919000000002'),
  ('50000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a', 'Aman', '+919000000003'),
  ('50000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'B Student', '+919000000009');
insert into public.subscriptions (id, library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'empty',
   '2026-12-01', '2026-12-31', 1, 60000);
insert into public.invoices (id, library_id, student_id, subscription_id, amount_due_paise, due_date) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000001',
   '60000000-0000-0000-0000-000000000001', 60000, '2026-12-01');
insert into public.expenses (library_id, category, amount_paise, note) values
  ('10000000-0000-0000-0000-00000000000a', 'rent', 1500000, 'owner expense');

select is(
  (select user_id from public.memberships where phone = '+918000000002'),
  '00000000-0000-0000-0000-0000000000a2'::uuid,
  'staff invite is linked to the login with the same phone');

-- ---------------------------------------------------------------- seat clashes
select lives_ok($$
  insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise)
  values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002',
          '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'empty', '2026-12-01', '2026-12-31', 1, 60000)
$$, 'Morning and Evening can share one seat');

select throws_ok($$
  insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise)
  values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003',
          '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'empty', '2026-12-20', '2027-01-19', 20, 120000)
$$, '23P01', null, 'Full Day cannot take a seat that is busy in any shift');

select throws_ok($$
  insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise)
  values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
          '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'empty', '2026-12-31', '2027-01-30', 31, 60000)
$$, '23P01', null, 'Morning seat cannot be double-booked even by one overlapping day');

select lives_ok($$
  insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise)
  values ('10000000-0000-0000-0000-00000000000a', '50000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
          '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'empty', '2027-01-01', '2027-01-31', 1, 60000)
$$, 'The next period can start the day after the previous one ends');

select lives_ok($$
  update public.subscriptions set status = 'expired' where id = '60000000-0000-0000-0000-000000000001'
$$, 'Expiring a plan works');

-- ---------------------------------------------------------------- invoices follow payments
insert into public.payments (library_id, invoice_id, student_id, amount_paise, method)
values ('10000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 20000, 'cash');
select is((select status::text from public.invoices where id = '70000000-0000-0000-0000-000000000001'), 'partial', '₹200 of ₹600 makes the invoice partial');
insert into public.payments (library_id, invoice_id, student_id, amount_paise, method)
values ('10000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 40000, 'upi');
select is((select status::text from public.invoices where id = '70000000-0000-0000-0000-000000000001'), 'paid', 'the remaining ₹400 makes it paid');

select throws_ok($$ update public.payments set amount_paise = 1 $$, 'P0001', 'PAYMENT_IMMUTABLE', 'payments cannot be edited');
select throws_ok($$ delete from public.payments $$, 'P0001', 'PAYMENT_IMMUTABLE', 'payments cannot be deleted');

-- ---------------------------------------------------------------- as owner of library B
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);

select is((select count(*)::int from public.students), 1, 'owner B sees only their own student');
select is((select count(*)::int from public.payments), 0, 'owner B sees no payments from library A');
select is((select count(*)::int from public.libraries), 1, 'owner B sees only their own library');
select is((select count(*)::int from public.memberships), 1, 'owner B sees only their own staff');
update public.students set name = 'hacked' where library_id = '10000000-0000-0000-0000-00000000000a';
select is((select count(*)::int from public.students where name = 'hacked'), 0, 'owner B cannot edit library A');
select throws_ok($$
  insert into public.students (library_id, name, phone) values ('10000000-0000-0000-0000-00000000000a', 'Spy', '+919111111111')
$$, '42501', null, 'owner B cannot add students to library A');

-- ---------------------------------------------------------------- as desk of library A
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated"}', true);

select is((select count(*)::int from public.students), 3, 'desk sees their library''s students');
delete from public.students where id = '50000000-0000-0000-0000-000000000002';
select is((select count(*)::int from public.students), 3, 'desk cannot delete students');
select is((select count(*)::int from public.expenses), 0, 'desk cannot see the owner''s expenses');
select is((select count(*)::int from public.activity_log), 0, 'desk cannot read the audit trail');
select throws_ok($$
  update public.subscriptions set discount_paise = 10000, discount_reason = 'friend'
  where id = '60000000-0000-0000-0000-000000000001'
$$, '42501', 'NO_DISCOUNT_PERMISSION', 'desk cannot give discounts');
select throws_ok($$
  update public.profiles set is_platform_admin = true where id = '00000000-0000-0000-0000-0000000000a2'
$$, '42501', null, 'nobody can make themselves platform admin');

-- ---------------------------------------------------------------- as owner of library A
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}', true);
select is((select count(*)::int from public.expenses), 1, 'owner sees expenses');

-- ---------------------------------------------------------------- anonymous
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.students $$, '42501', null, 'logged-out visitors can read nothing');

select * from finish();
rollback;

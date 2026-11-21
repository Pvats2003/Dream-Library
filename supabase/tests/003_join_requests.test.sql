-- Join link: public form, spam limits, privacy, approval, opening balances.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, phone, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', '918200000001', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', '918200000003', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', '918200000009', 'authenticated', 'authenticated');
insert into public.libraries (id, name, slug, join_code) values
  ('10000000-0000-0000-0000-00000000000a', 'Lib A', 'lib-a-p3', 'abcdef1234'),
  ('10000000-0000-0000-0000-00000000000b', 'Lib B', 'lib-b-p3', 'zzzzzz9999');
insert into public.memberships (library_id, phone, display_name, role) values
  ('10000000-0000-0000-0000-00000000000a', '+918200000001', 'Owner', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '+918200000003', 'Desk', 'desk'),
  ('10000000-0000-0000-0000-00000000000b', '+918200000009', 'Owner B', 'owner');
insert into public.shifts (id, library_id, name, start_min, end_min) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning', 360, 720);
insert into public.plans (id, library_id, name, shift_id, duration_months, price_paise) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Morning Monthly', '20000000-0000-0000-0000-000000000001', 1, 60000);
insert into public.seats (id, library_id, label) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'A1');

-- ---------------------------------------------------------------- not logged in
set local role anon;
select is((public.get_join_form('ABCDEF1234') ->> 'library_name'), 'Lib A', 'the form works from the link, any letter case');
select is(jsonb_array_length(public.get_join_form('abcdef1234') -> 'shifts'), 1, 'the form lists the library''s shifts');
select is(public.get_join_form('nope'), null, 'a wrong link shows nothing');

select lives_ok($$
  select public.submit_join_request('abcdef1234', jsonb_build_object(
    'name', 'Rahul Kumar', 'phone', '+919800000001', 'gender', 'male',
    'shift_id', '20000000-0000-0000-0000-000000000001', 'seat_label', ' a1 ',
    'last_paid_on', (current_date - 5)::text))
$$, 'a student can send their details without logging in');
select lives_ok($$
  select public.submit_join_request('abcdef1234', jsonb_build_object('name', 'Rahul K', 'phone', '+919800000001'))
$$, 'sending again is accepted');
select throws_ok($$ select public.submit_join_request('abcdef1234', jsonb_build_object('name', 'X', 'phone', '12345')) $$,
  '22023', 'INVALID', 'a wrong phone number is rejected');
select throws_ok($$ select public.submit_join_request('wrong', jsonb_build_object('name', 'X', 'phone', '+919800000002')) $$,
  'P0002', 'BAD_LINK', 'a wrong link is rejected');
select throws_ok($$ select count(*) from public.join_requests $$, '42501', null, 'visitors cannot read anyone''s requests');
select throws_ok($$ select count(*) from public.students $$, '42501', null, 'visitors cannot read students');

-- Spam: 5 per number per day.
select public.submit_join_request('abcdef1234', jsonb_build_object('name', 'Spam', 'phone', '+919811111111')) from generate_series(1, 4);
reset role;
update public.join_requests set status = 'rejected' where phone = '+919811111111';
set local role anon;
select public.submit_join_request('abcdef1234', jsonb_build_object('name', 'Spam', 'phone', '+919811111111'));
reset role;
insert into public.join_requests (library_id, name, phone, status) select '10000000-0000-0000-0000-00000000000a', 'Spam', '+919811111111', 'rejected' from generate_series(1, 4);
set local role anon;
select throws_ok($$ select public.submit_join_request('abcdef1234', jsonb_build_object('name', 'Spam', 'phone', '+919811111111')) $$,
  '54000', 'TOO_MANY', 'the same number cannot flood the inbox');

-- ---------------------------------------------------------------- desk reviews
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a3", "role": "authenticated"}', true);
select is((select count(*)::int from public.join_requests where status = 'pending' and phone = '+919800000001'), 1,
  'sending twice leaves one waiting request');
select is((select seat_label from public.join_requests where phone = '+919800000001'), null,
  'the second send replaced the first (it had no seat)');

create temp table imp as select public.import_student(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a',
  'request_id', (select id from public.join_requests where phone = '+919800000001'),
  'name', 'Rahul Kumar', 'phone', '+919800000001', 'gender', 'male',
  'plan_id', '30000000-0000-0000-0000-000000000001', 'seat_id', '40000000-0000-0000-0000-000000000001',
  'start_date', (current_date - 5)::text, 'pending_paise', 0)) as res;

select is((select status::text from public.join_requests where phone = '+919800000001'), 'approved', 'desk approves the request');
select is((select status::text from public.subscriptions where id = (select (res ->> 'subscription_id')::uuid from imp)), 'active',
  'their plan is running');
select is((select status::text from public.invoices where student_id = (select (res ->> 'student_id')::uuid from imp)), 'paid',
  'fees paid before the app count as paid');
select is((select count(*)::int from public.payments where student_id = (select (res ->> 'student_id')::uuid from imp)), 0,
  'but they are not payments — so not today''s earnings');

-- Owes part: pending ₹200 of ₹600, with a later payment of ₹200 settling it.
create temp table imp2 as select public.import_student(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a',
  'name', 'Priya', 'phone', '+919800000003', 'gender', 'female',
  'plan_id', '30000000-0000-0000-0000-000000000001',
  'start_date', (current_date - 2)::text, 'pending_paise', 20000)) as res;
select is((select status::text from public.invoices where student_id = (select (res ->> 'student_id')::uuid from imp2)), 'partial',
  'a student who still owes shows as part-paid');
insert into public.payments (library_id, invoice_id, student_id, amount_paise, method)
select library_id, id, student_id, 20000, 'cash' from public.invoices where student_id = (select (res ->> 'student_id')::uuid from imp2);
select is((select status::text from public.invoices where student_id = (select (res ->> 'student_id')::uuid from imp2)), 'paid',
  'paying the rest later counts the opening amount too');

select throws_ok($$ select public.import_student(jsonb_build_object(
  'library_id', '10000000-0000-0000-0000-00000000000a', 'name', 'Dup', 'phone', '+919800000001',
  'plan_id', '30000000-0000-0000-0000-000000000001', 'start_date', current_date::text)) $$,
  '23505', 'PHONE_EXISTS', 'cannot add the same number twice');

-- ---------------------------------------------------------------- other library
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}', true);
select is((select count(*)::int from public.join_requests), 0, 'another library''s owner sees none of these requests');

reset role;
select throws_ok($$ delete from public.memberships where phone = '+918200000009' $$, 'P0001', 'LAST_OWNER',
  'the only owner cannot be removed while the library exists');
select lives_ok($$ delete from public.libraries where id = '10000000-0000-0000-0000-00000000000b' $$,
  'a whole library (with its owner, students and payments) can be deleted');

select * from finish();
rollback;

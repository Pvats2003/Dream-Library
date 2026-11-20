-- The morning picture in one call. Money totals are only returned to people
-- allowed to see earnings; everyone else gets counts (PLAN.md §2.8).
create or replace function public.today_summary(lib uuid, on_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  can_money boolean;
  day_start timestamptz;
  day_end timestamptz;
  tz text;
  result jsonb;
begin
  if not private.is_member(lib) then
    raise exception 'NOT_A_MEMBER' using errcode = '42501';
  end if;
  can_money := private.has_perm(lib, 'can_see_earnings');
  select l.timezone into tz from public.libraries l where l.id = lib;
  day_start := (on_date::timestamp at time zone tz);
  day_end := ((on_date + 1)::timestamp at time zone tz);

  with
  collected as (
    select coalesce(sum(p.amount_paise), 0) as paise, count(*) filter (where p.amount_paise > 0) as n
    from public.payments p
    where p.library_id = lib and p.received_at >= day_start and p.received_at < day_end
  ),
  open_invoices as (
    select i.*, i.amount_due_paise - i.amount_paid_paise as owed
    from public.invoices i
    join public.students s on s.id = i.student_id and s.deleted_at is null and s.status <> 'left'
    where i.library_id = lib and i.status in ('due', 'partial')
      and (i.snoozed_until is null or i.snoozed_until <= on_date)
  ),
  overdue as (
    select coalesce(sum(owed), 0) as paise, count(distinct student_id) as n
    from open_invoices where due_date < on_date
  ),
  due_week as (
    select coalesce(sum(owed), 0) as paise, count(distinct student_id) as n
    from open_invoices where due_date between on_date and on_date + 6
  ),
  -- Plans ending in the next 7 days with no follow-on plan yet.
  ending as (
    select count(*) as n, coalesce(sum(sub.price_paise - sub.discount_paise), 0) as paise
    from public.subscriptions sub
    join public.students s on s.id = sub.student_id and s.deleted_at is null and s.status = 'active'
    where sub.library_id = lib and sub.status = 'active'
      and sub.end_date between on_date and on_date + 6
      and not exists (
        select 1 from public.subscriptions nxt
        where nxt.renewed_from_id = sub.id or (nxt.student_id = sub.student_id and nxt.start_date > sub.end_date
              and nxt.status in ('upcoming', 'active')))
  ),
  base_shifts as (
    select sh.id, sh.name, sh.minutes, sh.sort_order, sh.is_full_day
    from public.shifts sh where sh.library_id = lib and sh.is_active
  ),
  active_seats as (
    select st.id from public.seats st where st.library_id = lib and st.is_active
  ),
  busy as (
    select sub.seat_id, sub.shift_minutes
    from public.subscriptions sub
    where sub.library_id = lib and sub.seat_id is not null
      and sub.status in ('active', 'paused', 'upcoming')
      and sub.active_dates @> on_date
  ),
  free_by_shift as (
    select bs.id, bs.name, bs.sort_order, bs.is_full_day,
           (select count(*) from active_seats) as total,
           (select count(*) from active_seats a
             where not exists (select 1 from busy b where b.seat_id = a.id and b.shift_minutes && bs.minutes)) as free
    from base_shifts bs
  ),
  in_now as (
    select count(*) as n from public.attendance a
    where a.library_id = lib and a.check_out_at is null and a.check_in_at >= day_start
  )
  select jsonb_build_object(
    'can_see_money', can_money,
    'collected_today', case when can_money then (select paise from collected) end,
    'payments_today', (select n from collected),
    'overdue_paise', case when can_money then (select paise from overdue) end,
    'overdue_students', (select n from overdue),
    'due_week_paise', case when can_money then (select paise from due_week) + (select paise from ending) end,
    'due_week_students', (select n from due_week) + (select n from ending),
    'ending_week', (select n from ending),
    'in_library_now', (select n from in_now),
    'active_students', (select count(*) from public.students s where s.library_id = lib and s.status = 'active' and s.deleted_at is null),
    'seats', coalesce((
      select jsonb_agg(jsonb_build_object('shift_id', f.id, 'name', f.name, 'free', f.free, 'total', f.total, 'full_day', f.is_full_day)
                       order by f.sort_order)
      from free_by_shift f), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.today_summary(uuid, date) from public, anon;
grant execute on function public.today_summary(uuid, date) to authenticated;

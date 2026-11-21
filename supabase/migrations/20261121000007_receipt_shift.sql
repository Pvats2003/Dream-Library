-- Receipt shows the shift (e.g. "Morning") next to the seat.
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
    'shift_name', sh.name,
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
  left join public.shifts sh on sh.id = sub.shift_id
  where p.receipt_token = token and p.amount_paise > 0;
$$;

revoke all on function public.get_receipt(text) from public;
grant execute on function public.get_receipt(text) to anon, authenticated;

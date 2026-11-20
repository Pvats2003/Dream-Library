-- Access rules, data-integrity triggers and Row Level Security.
-- Helper functions live in the `private` schema, which the API never exposes.

-- ---------------------------------------------------------------------------
-- Permission model
-- ---------------------------------------------------------------------------
-- Defaults per role. The owner can switch individual flags per person; the UI
-- asks plain questions ("Can they see total earnings?") instead of role names.
create or replace function private.default_permissions(r public.member_role)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case r
    when 'owner' then jsonb_build_object(
      'can_see_earnings', true, 'can_discount', true, 'can_delete', true,
      'can_edit_settings', true, 'can_manage_staff', true)
    when 'manager' then jsonb_build_object(
      'can_see_earnings', false, 'can_discount', true, 'can_delete', true,
      'can_edit_settings', false, 'can_manage_staff', false)
    else jsonb_build_object(
      'can_see_earnings', false, 'can_discount', false, 'can_delete', false,
      'can_edit_settings', false, 'can_manage_staff', false)
  end;
$$;

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false);
$$;

create or replace function private.is_member(lib uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.library_id = lib and m.user_id = auth.uid() and m.is_active
  ) or private.is_platform_admin();
$$;

-- Owners always have every permission; everyone else per flag.
create or replace function private.has_perm(lib uuid, perm text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.library_id = lib and m.user_id = auth.uid() and m.is_active
      and (m.role = 'owner' or coalesce((m.permissions ->> perm)::boolean, false))
  ) or private.is_platform_admin();
$$;

-- Libraries the current user may work in (for the switcher).
create or replace function public.my_memberships()
returns table (
  membership_id uuid,
  library_id uuid,
  library_name text,
  library_slug text,
  role public.member_role,
  permissions jsonb,
  setup_completed boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, l.id, l.name, l.slug, m.role,
         case when m.role = 'owner' then private.default_permissions('owner')
              else private.default_permissions(m.role) || m.permissions end,
         l.setup_completed_at is not null
  from public.memberships m
  join public.libraries l on l.id = m.library_id
  where m.user_id = auth.uid() and m.is_active
  order by l.name;
$$;

-- ---------------------------------------------------------------------------
-- New login → profile, and link any staff invites waiting for this phone
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized text := case when new.phone is null or new.phone = '' then null
                          else '+' || ltrim(new.phone, '+') end;
begin
  insert into public.profiles (id, phone)
  values (new.id, normalized)
  on conflict (id) do nothing;

  if normalized is not null then
    update public.memberships
       set user_id = new.id
     where phone = normalized and user_id is null;
    -- Student portal (phase 5): link student records by phone.
    update public.students
       set user_id = new.id
     where phone = normalized and user_id is null and deleted_at is null;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Fill role defaults when a membership is created with no explicit flags.
create or replace function private.membership_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.permissions := private.default_permissions(new.role) || coalesce(new.permissions, '{}'::jsonb);
  if new.user_id is null then
    select u.id into new.user_id
    from auth.users u
    where '+' || ltrim(u.phone, '+') = new.phone
    limit 1;
  end if;
  return new;
end;
$$;

create trigger membership_defaults
  before insert on public.memberships
  for each row execute function private.membership_defaults();

-- A library must always keep at least one active owner.
create or replace function private.protect_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

create trigger protect_last_owner
  before update or delete on public.memberships
  for each row execute function private.protect_last_owner();

-- ---------------------------------------------------------------------------
-- Subscriptions: copy shift hours, guard discounts
-- ---------------------------------------------------------------------------
create or replace function private.subscription_prepare()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or new.shift_id is distinct from old.shift_id then
    select s.minutes into new.shift_minutes
    from public.shifts s
    where s.id = new.shift_id and s.library_id = new.library_id;
  end if;

  -- Discounts need permission (desk staff can't give them). Service role
  -- (seed, nightly jobs) has no auth.uid() and is trusted.
  if new.discount_paise > 0
     and (tg_op = 'INSERT' or new.discount_paise is distinct from old.discount_paise)
     and auth.uid() is not null
     and not private.has_perm(new.library_id, 'can_discount')
  then
    raise exception 'NO_DISCOUNT_PERMISSION' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger subscription_prepare
  before insert or update on public.subscriptions
  for each row execute function private.subscription_prepare();

-- If shift hours change, live subscriptions follow. The exclusion constraint
-- rejects the change if it would create a seat clash.
create or replace function private.shift_hours_changed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.minutes is distinct from old.minutes then
    update public.subscriptions
       set shift_minutes = new.minutes
     where shift_id = new.id and status in ('upcoming', 'active', 'paused');
  end if;
  return new;
end;
$$;

create trigger shift_hours_changed
  after update on public.shifts
  for each row execute function private.shift_hours_changed();

-- ---------------------------------------------------------------------------
-- Payments: insert-only, and they keep their invoice's paid amount current
-- ---------------------------------------------------------------------------
create or replace function private.payments_are_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- The only way a payment disappears is the whole library being deleted.
  if tg_op = 'DELETE' and not exists (select 1 from public.libraries l where l.id = old.library_id) then
    return old;
  end if;
  raise exception 'PAYMENT_IMMUTABLE' using errcode = 'P0001',
    hint = 'Payments cannot be changed. Record a reversal instead.';
end;
$$;

create trigger payments_are_immutable
  before update or delete on public.payments
  for each row execute function private.payments_are_immutable();

create or replace function private.refresh_invoice_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  paid integer;
begin
  select coalesce(sum(p.amount_paise), 0) into paid
  from public.payments p where p.invoice_id = new.invoice_id;

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

create trigger refresh_invoice_paid
  after insert on public.payments
  for each row execute function private.refresh_invoice_paid();

-- Changing what an invoice asks for (or waiving it) is a discount in disguise.
create or replace function private.invoice_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.amount_due_paise is distinct from old.amount_due_paise
          or (new.status = 'waived' and old.status <> 'waived'))
     and not private.has_perm(new.library_id, 'can_discount')
  then
    raise exception 'NO_DISCOUNT_PERMISSION' using errcode = '42501';
  end if;
  -- Status follows payments unless it is being waived/unwaived.
  if new.amount_due_paise is distinct from old.amount_due_paise and new.status <> 'waived' then
    new.status := case
      when new.amount_paid_paise >= new.amount_due_paise then 'paid'
      when new.amount_paid_paise > 0 then 'partial'
      else 'due' end;
  end if;
  return new;
end;
$$;

create trigger invoice_guard
  before update on public.invoices
  for each row execute function private.invoice_guard();

-- ---------------------------------------------------------------------------
-- Activity log (audit trail + undo)
-- ---------------------------------------------------------------------------
create or replace function private.log_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  lib uuid := (rec ->> 'library_id')::uuid;
begin
  if tg_table_name = 'libraries' then
    if tg_op = 'DELETE' then return old; end if;
    lib := (rec ->> 'id')::uuid;
  end if;
  -- Rows removed because their library is being deleted aren't logged.
  if tg_op = 'DELETE' and not exists (select 1 from public.libraries l where l.id = lib) then
    return old;
  end if;
  -- Skip no-op updates (e.g. updated_at only).
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return new;
  end if;
  insert into public.activity_log (library_id, action, entity, entity_id, before, after)
  values (
    lib,
    lower(tg_op),
    tg_table_name,
    (rec ->> 'id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'libraries','memberships','zones','seats','shifts','plans','students','subscriptions',
    'subscription_pauses','invoices','payments','deposits','expenses','message_templates'
  ] loop
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
         for each row execute function private.log_activity()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.libraries           enable row level security;
alter table public.profiles            enable row level security;
alter table public.memberships         enable row level security;
alter table public.zones               enable row level security;
alter table public.seats               enable row level security;
alter table public.shifts              enable row level security;
alter table public.plans               enable row level security;
alter table public.students            enable row level security;
alter table public.subscriptions       enable row level security;
alter table public.subscription_pauses enable row level security;
alter table public.invoices            enable row level security;
alter table public.payments            enable row level security;
alter table public.receipt_counters    enable row level security;
alter table public.deposits            enable row level security;
alter table public.expenses            enable row level security;
alter table public.message_templates   enable row level security;
alter table public.reminders           enable row level security;
alter table public.attendance          enable row level security;
alter table public.waitlist            enable row level security;
alter table public.leads               enable row level security;
alter table public.activity_log        enable row level security;

-- Libraries: members read; settings permission edits. Creation goes through
-- create_library() so the owner membership is made in the same step.
create policy libraries_select on public.libraries for select to authenticated
  using ((select private.is_member(id)));
create policy libraries_update on public.libraries for update to authenticated
  using ((select private.has_perm(id, 'can_edit_settings')))
  with check ((select private.has_perm(id, 'can_edit_settings')));

-- Profiles: only your own.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Memberships: members see their colleagues; staff managers change them.
create policy memberships_select on public.memberships for select to authenticated
  using ((select private.is_member(library_id)));
create policy memberships_insert on public.memberships for insert to authenticated
  with check ((select private.has_perm(library_id, 'can_manage_staff')));
create policy memberships_update on public.memberships for update to authenticated
  using ((select private.has_perm(library_id, 'can_manage_staff')))
  with check ((select private.has_perm(library_id, 'can_manage_staff')));
create policy memberships_delete on public.memberships for delete to authenticated
  using ((select private.has_perm(library_id, 'can_manage_staff')));

-- Layout and pricing: everyone reads, settings permission writes.
do $$
declare t text;
begin
  foreach t in array array['zones', 'seats', 'shifts', 'plans', 'message_templates'] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
      using ((select private.is_member(library_id)))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
      with check ((select private.has_perm(library_id, ''can_edit_settings'')))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated
      using ((select private.has_perm(library_id, ''can_edit_settings'')))
      with check ((select private.has_perm(library_id, ''can_edit_settings'')))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated
      using ((select private.has_perm(library_id, ''can_edit_settings'')))', t);
  end loop;
end;
$$;

-- Day-to-day records: every staff member reads, adds and edits; deleting
-- needs the delete permission. (Desk staff can admit, collect and check in.)
do $$
declare t text;
begin
  foreach t in array array[
    'students', 'subscriptions', 'subscription_pauses', 'invoices', 'deposits',
    'reminders', 'attendance', 'waitlist', 'leads'
  ] loop
    execute format('create policy %1$s_select on public.%1$I for select to authenticated
      using ((select private.is_member(library_id)))', t);
    execute format('create policy %1$s_insert on public.%1$I for insert to authenticated
      with check ((select private.is_member(library_id)))', t);
    execute format('create policy %1$s_update on public.%1$I for update to authenticated
      using ((select private.is_member(library_id)))
      with check ((select private.is_member(library_id)))', t);
    execute format('create policy %1$s_delete on public.%1$I for delete to authenticated
      using ((select private.has_perm(library_id, ''can_delete'')))', t);
  end loop;
end;
$$;

-- Payments: read and insert only. No update/delete policy exists, and the
-- immutability trigger blocks even privileged roles.
create policy payments_select on public.payments for select to authenticated
  using ((select private.is_member(library_id)));
create policy payments_insert on public.payments for insert to authenticated
  with check (
    (select private.is_member(library_id))
    -- Reversals need the delete permission.
    and (reverses_payment_id is null or (select private.has_perm(library_id, 'can_delete')))
  );

-- Expenses reveal the library's finances: anyone can log one, but only
-- people who can see earnings can list them (others see only their own).
create policy expenses_select on public.expenses for select to authenticated
  using (
    (select private.has_perm(library_id, 'can_see_earnings'))
    or ((select private.is_member(library_id)) and created_by = (select auth.uid()))
  );
create policy expenses_insert on public.expenses for insert to authenticated
  with check ((select private.is_member(library_id)));
create policy expenses_update on public.expenses for update to authenticated
  using ((select private.has_perm(library_id, 'can_see_earnings')))
  with check ((select private.has_perm(library_id, 'can_see_earnings')));

-- Audit trail: owners and anyone trusted with deletes (managers by default).
create policy activity_log_select on public.activity_log for select to authenticated
  using ((select private.has_perm(library_id, 'can_delete')));

-- receipt_counters: no policies at all; only security-definer functions touch it.

-- ---------------------------------------------------------------------------
-- Grants (explicit, so behaviour doesn't depend on project defaults)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke all on public.receipt_counters from authenticated;
-- Profiles: people may edit only their name and preferences, never the
-- platform-admin flag; rows are created by the signup trigger.
revoke insert, update, delete on public.profiles from authenticated;
grant update (full_name, locale, theme) on public.profiles to authenticated;
revoke insert, update, delete on public.activity_log from authenticated;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
revoke execute on function public.my_memberships() from public, anon;
grant execute on function public.my_memberships() to authenticated;

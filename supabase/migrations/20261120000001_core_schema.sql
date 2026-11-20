-- LibraryOS core schema.
-- Conventions:
--   * Every business table carries library_id (multi-tenant from day one).
--   * Money is integer paise. Never numeric/float.
--   * Moments are timestamptz (UTC). Plan periods are plain `date`s in the
--     library's local calendar (see PLAN.md §2.4).
--   * RLS is enabled on every table (see 20261120000002_security.sql).

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'manager', 'desk');
create type public.student_status as enum ('active', 'paused', 'left');
create type public.subscription_status as enum ('upcoming', 'active', 'paused', 'expired', 'cancelled');
create type public.invoice_status as enum ('due', 'partial', 'paid', 'waived');
create type public.payment_method as enum ('cash', 'upi', 'card', 'bank');
create type public.deposit_status as enum ('held', 'refunded', 'adjusted');
create type public.attendance_method as enum ('qr', 'manual');
create type public.waitlist_status as enum ('waiting', 'offered', 'converted', 'dropped');
create type public.expense_category as enum ('rent', 'electricity', 'internet', 'salary', 'maintenance', 'other');
create type public.gender as enum ('male', 'female', 'other');
create type public.student_source as enum ('walk_in', 'referral', 'instagram', 'google', 'whatsapp', 'other');
create type public.lead_status as enum ('new', 'contacted', 'trial_booked', 'converted', 'lost');

-- ---------------------------------------------------------------------------
-- Shared trigger: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Libraries, people, access
-- ---------------------------------------------------------------------------
create table public.libraries (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) between 1 and 120),
  slug             text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  address          text,
  city             text,
  lat              double precision,
  lng              double precision,
  timezone         text not null default 'Asia/Kolkata',
  currency         text not null default 'INR',
  upi_id           text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,200}@[A-Za-z]{2,64}$'),
  whatsapp_number  text check (whatsapp_number is null or whatsapp_number ~ '^\+91[6-9][0-9]{9}$'),
  logo_path        text,
  brand_color      text not null default '#3B3FB6' check (brand_color ~ '^#[0-9A-Fa-f]{6}$'),
  receipt_prefix   text not null default 'RC' check (receipt_prefix ~ '^[A-Z0-9]{1,6}$'),
  -- deposit_paise, late_fee_per_day_paise, reminder_days[], etc.
  settings         jsonb not null default '{}'::jsonb,
  setup_completed_at timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid()
);

create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text,
  phone              text,
  locale             text not null default 'hi' check (locale in ('hi', 'en')),
  theme              text not null default 'system' check (theme in ('system', 'light', 'dark')),
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Staff of a library. A row can exist before the person has ever logged in
-- (invited by phone); it is linked to their auth user on first login.
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  library_id    uuid not null references public.libraries (id) on delete cascade,
  user_id       uuid references auth.users (id) on delete cascade,
  phone         text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  display_name  text not null,
  role          public.member_role not null,
  -- can_see_earnings, can_discount, can_delete, can_edit_settings, can_manage_staff
  permissions   jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (library_id, phone)
);
create unique index memberships_library_user_idx on public.memberships (library_id, user_id) where user_id is not null;
create index memberships_user_idx on public.memberships (user_id);

-- ---------------------------------------------------------------------------
-- Space and time: zones, seats, shifts, plans
-- ---------------------------------------------------------------------------
create table public.zones (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  name        text not null,
  sort_order  smallint not null default 0,
  -- { "ac": true, "girls_only": false, "cabin": false }
  attributes  jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (library_id, name),
  unique (id, library_id)
);

create table public.seats (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  zone_id     uuid,
  label       text not null check (length(trim(label)) between 1 and 12),
  x           smallint not null default 0,
  y           smallint not null default 0,
  rotation    smallint not null default 0 check (rotation in (0, 90, 180, 270)),
  is_active   boolean not null default true,
  -- window, charging, near_ac, corner, ...
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (library_id, label),
  unique (id, library_id),
  foreign key (zone_id, library_id) references public.zones (id, library_id) on delete set null (zone_id)
);
create index seats_library_idx on public.seats (library_id);

-- Shift hours are stored as minutes from midnight so overlap is a range test.
-- Full Day (06:00-23:00) overlaps every other shift, so a full-day seat
-- automatically blocks all shifts (PLAN.md §2.3).
create table public.shifts (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references public.libraries (id) on delete cascade,
  name         text not null,
  start_min    smallint not null check (start_min between 0 and 1439),
  end_min      smallint not null check (end_min between 1 and 1440),
  minutes      int4range generated always as (int4range(start_min, end_min, '[)')) stored,
  is_full_day  boolean not null default false,
  sort_order   smallint not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid default auth.uid(),
  check (start_min < end_min),
  unique (library_id, name),
  unique (id, library_id)
);

create table public.plans (
  id               uuid primary key default gen_random_uuid(),
  library_id       uuid not null references public.libraries (id) on delete cascade,
  name             text not null,
  shift_id         uuid not null,
  duration_months  smallint check (duration_months between 1 and 24),
  duration_days    smallint check (duration_days between 1 and 366),
  price_paise      integer not null check (price_paise >= 0),
  is_active        boolean not null default true,
  sort_order       smallint not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  check ((duration_months is null) <> (duration_days is null)),
  unique (library_id, name),
  unique (id, library_id),
  foreign key (shift_id, library_id) references public.shifts (id, library_id)
);

-- ---------------------------------------------------------------------------
-- Students and their plans
-- ---------------------------------------------------------------------------
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  library_id      uuid not null references public.libraries (id) on delete cascade,
  name            text not null check (length(trim(name)) between 1 and 120),
  phone           text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  alt_phone       text check (alt_phone is null or alt_phone ~ '^\+91[6-9][0-9]{9}$'),
  photo_path      text,
  id_proof_path   text,
  exam_target     text,
  gender          public.gender,
  address         text,
  guardian_phone  text check (guardian_phone is null or guardian_phone ~ '^\+91[6-9][0-9]{9}$'),
  joined_on       date not null default current_date,
  status          public.student_status not null default 'active',
  notes           text,
  source          public.student_source,
  referred_by     uuid,
  user_id         uuid references auth.users (id) on delete set null, -- student portal (phase 5)
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid default auth.uid(),
  unique (id, library_id),
  foreign key (referred_by, library_id) references public.students (id, library_id) on delete set null (referred_by)
);
create unique index students_phone_per_library on public.students (library_id, phone) where deleted_at is null;
create index students_library_status_idx on public.students (library_id, status) where deleted_at is null;
create index students_user_idx on public.students (user_id) where user_id is not null;

create table public.subscriptions (
  id               uuid primary key default gen_random_uuid(),
  library_id       uuid not null references public.libraries (id) on delete cascade,
  student_id       uuid not null,
  plan_id          uuid not null,
  seat_id          uuid,
  shift_id         uuid not null,
  -- Copied from the shift so the exclusion constraint can see it. Kept in
  -- sync by trigger when shift hours change.
  shift_minutes    int4range not null,
  start_date       date not null,
  end_date         date not null,
  active_dates     daterange generated always as (daterange(start_date, end_date, '[]')) stored,
  -- Day of month fees fall due; keeps 31 Jan joiners on 31 Mar, not 28 Mar.
  billing_day      smallint not null check (billing_day between 1 and 31),
  price_paise      integer not null check (price_paise >= 0),
  discount_paise   integer not null default 0 check (discount_paise >= 0),
  discount_reason  text,
  status           public.subscription_status not null default 'active',
  auto_renew       boolean not null default true,
  renewed_from_id  uuid references public.subscriptions (id) on delete set null,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  check (end_date >= start_date),
  check (discount_paise <= price_paise),
  check (discount_paise = 0 or length(trim(coalesce(discount_reason, ''))) > 0),
  unique (id, library_id),
  foreign key (student_id, library_id) references public.students (id, library_id),
  foreign key (plan_id, library_id) references public.plans (id, library_id),
  foreign key (seat_id, library_id) references public.seats (id, library_id),
  foreign key (shift_id, library_id) references public.shifts (id, library_id),
  -- THE seat-clash rule: one seat, overlapping hours, overlapping dates = impossible.
  constraint no_seat_clash exclude using gist (
    seat_id      with =,
    shift_minutes with &&,
    active_dates with &&
  ) where (status in ('upcoming', 'active', 'paused') and seat_id is not null)
);
create index subscriptions_student_idx on public.subscriptions (student_id);
create index subscriptions_library_status_idx on public.subscriptions (library_id, status, end_date);

create table public.subscription_pauses (
  id               uuid primary key default gen_random_uuid(),
  library_id       uuid not null references public.libraries (id) on delete cascade,
  subscription_id  uuid not null,
  from_date        date not null,
  to_date          date not null,
  reason           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid default auth.uid(),
  check (to_date >= from_date),
  foreign key (subscription_id, library_id) references public.subscriptions (id, library_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
create table public.invoices (
  id                uuid primary key default gen_random_uuid(),
  library_id        uuid not null references public.libraries (id) on delete cascade,
  student_id        uuid not null,
  subscription_id   uuid,
  amount_due_paise  integer not null check (amount_due_paise >= 0),
  -- Maintained by trigger from payments (sum incl. reversals).
  amount_paid_paise integer not null default 0,
  due_date          date not null,
  period_start      date,
  period_end        date,
  status            public.invoice_status not null default 'due',
  snoozed_until     date,
  waived_reason     text,
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  unique (id, library_id),
  foreign key (student_id, library_id) references public.students (id, library_id),
  foreign key (subscription_id, library_id) references public.subscriptions (id, library_id) on delete set null (subscription_id)
);
create index invoices_library_status_due_idx on public.invoices (library_id, status, due_date);
create index invoices_student_idx on public.invoices (student_id);

-- Insert-only. Mistakes are fixed with a reversal row (negative amount).
create table public.payments (
  id                  uuid primary key default gen_random_uuid(),
  library_id          uuid not null references public.libraries (id) on delete cascade,
  invoice_id          uuid not null,
  student_id          uuid not null,
  amount_paise        integer not null check (amount_paise <> 0),
  method              public.payment_method not null,
  reference           text,
  received_by         uuid default auth.uid(),
  received_at         timestamptz not null default now(),
  receipt_number      text,
  -- Unguessable token for the public receipt link /r/<token>.
  receipt_token       text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  reverses_payment_id uuid unique,
  reversal_reason     text,
  -- Idempotency key from the phone's offline queue.
  client_op_id        uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid default auth.uid(),
  unique (id, library_id),
  unique (library_id, receipt_number),
  unique (library_id, client_op_id),
  check ((amount_paise < 0) = (reverses_payment_id is not null)),
  check (reverses_payment_id is null or length(trim(coalesce(reversal_reason, ''))) > 0),
  foreign key (invoice_id, library_id) references public.invoices (id, library_id),
  foreign key (student_id, library_id) references public.students (id, library_id),
  foreign key (reverses_payment_id, library_id) references public.payments (id, library_id)
);
create index payments_library_received_idx on public.payments (library_id, received_at desc);
create index payments_invoice_idx on public.payments (invoice_id);
create index payments_student_idx on public.payments (student_id);

create table public.receipt_counters (
  library_id   uuid not null references public.libraries (id) on delete cascade,
  year         smallint not null,
  last_number  integer not null default 0,
  primary key (library_id, year)
);

create table public.deposits (
  id            uuid primary key default gen_random_uuid(),
  library_id    uuid not null references public.libraries (id) on delete cascade,
  student_id    uuid not null,
  amount_paise  integer not null check (amount_paise > 0),
  method        public.payment_method not null default 'cash',
  received_at   timestamptz not null default now(),
  status        public.deposit_status not null default 'held',
  settled_at    timestamptz,
  settled_note  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  foreign key (student_id, library_id) references public.students (id, library_id)
);
create index deposits_student_idx on public.deposits (student_id);

create table public.expenses (
  id            uuid primary key default gen_random_uuid(),
  library_id    uuid not null references public.libraries (id) on delete cascade,
  category      public.expense_category not null,
  amount_paise  integer not null check (amount_paise > 0),
  spent_on      date not null default current_date,
  note          text,
  client_op_id  uuid,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (library_id, client_op_id)
);
create index expenses_library_date_idx on public.expenses (library_id, spent_on desc) where deleted_at is null;

-- ---------------------------------------------------------------------------
-- Communication, attendance, growth
-- ---------------------------------------------------------------------------
create table public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  key         text not null check (key in ('welcome', 'reminder', 'expiring', 'receipt', 'overdue')),
  locale      text not null check (locale in ('hi', 'en')),
  body        text not null check (length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid(),
  unique (library_id, key, locale)
);

create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  library_id    uuid not null references public.libraries (id) on delete cascade,
  student_id    uuid not null,
  invoice_id    uuid,
  channel       text not null default 'whatsapp',
  template_key  text,
  body          text,
  sent_at       timestamptz not null default now(),
  sent_by       uuid default auth.uid(),
  client_op_id  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  unique (library_id, client_op_id),
  foreign key (student_id, library_id) references public.students (id, library_id),
  foreign key (invoice_id, library_id) references public.invoices (id, library_id) on delete set null (invoice_id)
);
create index reminders_student_idx on public.reminders (student_id, sent_at desc);

create table public.attendance (
  id            uuid primary key default gen_random_uuid(),
  library_id    uuid not null references public.libraries (id) on delete cascade,
  student_id    uuid not null,
  check_in_at   timestamptz not null default now(),
  check_out_at  timestamptz,
  method        public.attendance_method not null default 'manual',
  client_op_id  uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid default auth.uid(),
  check (check_out_at is null or check_out_at >= check_in_at),
  unique (library_id, client_op_id),
  foreign key (student_id, library_id) references public.students (id, library_id)
);
create index attendance_library_in_idx on public.attendance (library_id, check_in_at desc);
create index attendance_open_idx on public.attendance (library_id) where check_out_at is null;

create table public.waitlist (
  id                uuid primary key default gen_random_uuid(),
  library_id        uuid not null references public.libraries (id) on delete cascade,
  name              text not null,
  phone             text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  desired_shift_id  uuid,
  desired_zone_id   uuid,
  status            public.waitlist_status not null default 'waiting',
  note              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid default auth.uid(),
  foreign key (desired_shift_id, library_id) references public.shifts (id, library_id) on delete set null (desired_shift_id),
  foreign key (desired_zone_id, library_id) references public.zones (id, library_id) on delete set null (desired_zone_id)
);

create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  library_id  uuid not null references public.libraries (id) on delete cascade,
  name        text not null,
  phone       text not null check (phone ~ '^\+91[6-9][0-9]{9}$'),
  source      public.student_source,
  message     text,
  trial_date  date,
  status      public.lead_status not null default 'new',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);

create table public.activity_log (
  id          bigint generated always as identity primary key,
  library_id  uuid not null references public.libraries (id) on delete cascade,
  actor_id    uuid default auth.uid(),
  action      text not null check (action in ('insert', 'update', 'delete')),
  entity      text not null,
  entity_id   uuid,
  before      jsonb,
  after       jsonb,
  undone_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index activity_log_library_idx on public.activity_log (library_id, created_at desc);
create index activity_log_entity_idx on public.activity_log (entity, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'libraries','profiles','memberships','zones','seats','shifts','plans','students',
    'subscriptions','subscription_pauses','invoices','payments','deposits','expenses',
    'message_templates','reminders','attendance','waitlist','leads'
  ] loop
    execute format(
      'create trigger touch_updated_at before update on public.%I
         for each row execute function private.touch_updated_at()', t);
  end loop;
end;
$$;

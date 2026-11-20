# LibraryOS — Build Plan

> Status: **Phase 0, waiting for approval.** Nothing is built until you say "go".
> Working name: LibraryOS. First customer: Dream Library, Munger, Bihar.

---

## 1. What we're building, in one paragraph

A phone-first app that replaces the paper register at a self-study library. The owner logs in with his mobile number and OTP, sees today's money and free seats in 3 seconds, admits a student in under 60 seconds, and sends fee reminders on WhatsApp in one tap. It speaks Hindi first. Underneath, it's built as a multi-library product from day one, so we can sell it to other libraries later without a rewrite.

---

## 2. Key decisions (and why)

Each decision below has trade-offs. I explain them in plain words and make the call. You can overrule any of them.

### 2.1 Stack (latest stable versions, checked on 20 Nov 2026)

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js App Router, TypeScript strict | 16.4 |
| UI runtime | React | 19.3 |
| Styling | Tailwind CSS (CSS-first config, tokens as CSS variables) | 4.3 |
| Components | shadcn/ui source copied in and restyled; Radix primitives underneath | latest |
| Icons | lucide-react | 1.77 |
| Motion | `motion` (formerly Framer Motion) | 14.14 |
| Backend | Supabase: Postgres, Auth, Storage, Realtime | supabase-js 2.119, @supabase/ssr 0.12 |
| Forms | react-hook-form + Zod (one schema shared by client and server) | 7.92 / 4.6 |
| Client cache | TanStack Query (only on screens that need optimistic updates) | 5.108 |
| Dates | date-fns + @date-fns/tz | 4.4 |
| Translations | next-intl | 4.15 |
| PWA / offline | Serwist (the maintained successor to next-pwa) | 9.5 |
| Charts | Hand-built SVG for small charts (rings, sparklines); Recharts lazy-loaded only on Reports | 3.11 |
| Command palette | cmdk | latest |
| QR codes | `qrcode` | latest |
| Tests | Vitest (logic), Playwright (flows), pgTAP (database security rules) | 5.1 / 1.65 |
| Hosting | Vercel (app) + Supabase (data), Mumbai region for both | — |

**Why charts this way:** Recharts is about 100 KB. Loading it on the home screen would slow the app on a cheap phone. The home screen only needs rings and small bars, which are easy to draw by hand. Reports, which only the owner opens, can afford the heavier library.

### 2.2 Login: mobile number + OTP

Supabase supports phone OTP, but it needs an SMS provider. In India, sending OTP SMS legally requires **DLT registration** (a TRAI rule) for the sender ID and message template. That takes a few days and some paperwork.

**My call:**
- **Prototype (phases 1–4):** use Supabase's built-in *test phone numbers*. These are fixed numbers with a fixed OTP, configured in the dashboard, so no SMS is sent and nothing costs money. You and your friend can log in with real-looking flows.
- **Before real use:** connect **MSG91** (Indian, cheap, handles DLT well) or Twilio Verify. I'll give you click-by-click steps when we get there. The app code doesn't change, only a dashboard setting.

No email, no passwords, anywhere in the owner-facing app.

### 2.3 Seat clashes are impossible at the database level

This is the most important correctness rule, so it lives in Postgres, not in app code.

- Each shift stores its hours as a range of minutes in the day. Morning is 06:00–12:00, so `[360, 720)`. Full Day is `[360, 1380)`.
- Each subscription stores its date range (start to end date).
- One **exclusion constraint** says: *for the same seat, no two live subscriptions may overlap in both hours and dates.*

Because Full Day's hours overlap every other shift, a Full Day student automatically blocks the seat in every shift. No special code is needed. This also handles odd custom shifts later (say 09:00–15:00) without any change.

**Trade-off:** shifts that cross midnight (22:00–06:00) aren't supported in v1. Almost no library runs one. If Dream Library does, tell me and I'll split it into two ranges.

### 2.4 Dates and the month-end problem

- Moments (payment received at, check-in at) are stored in **UTC** and shown in **Asia/Kolkata**.
- Plan periods (start date, end date, due date) are stored as plain **calendar dates** in the library's timezone. "Plan ends on 5 Dec" is a date, not a moment, and storing it as a UTC timestamp causes the classic bug where a payment at 12:30 AM IST lands on the wrong day. I'm deviating slightly from "store everything in UTC" for this reason.
- A 1-month plan starting 5 Dec ends 4 Jan (both days included).
- **Month-end rule:** each subscription remembers its *billing day*. A student who joined on 31 Jan has fees due on 28 Feb → 31 Mar → 30 Apr → 31 May. They never slowly drift to the 28th. Unit-tested.

### 2.5 Money

All amounts are integers in **paise** (₹600 = 60000). Shown as `₹1,20,000` with `en-IN` formatting. Amounts in words use lakh and crore ("Rupees One Lakh Twenty Thousand Only" / "एक लाख बीस हज़ार रुपये"). There are no floats anywhere near money.

Payments **can't be edited or deleted**. A mistake is fixed by a *reversal* with a reason, which creates an opposite entry. The owner sees the history; nothing silently disappears.

### 2.6 Important actions run as single database functions

Admitting a student touches five tables: student, subscription, invoice, payment and deposit. If the phone loses signal halfway, we must not end up with a seat taken but no invoice.

**My call:** the multi-step money and seat actions (`admit_student`, `record_payment`, `renew_subscription`, `reverse_payment`, `move_seat`, `pause_subscription`, `mark_left`) are Postgres functions that run all-or-nothing. Next.js Server Actions validate input with Zod, then call the function. Simple reads use Server Components directly.

### 2.7 Working on weak internet

- **Always works offline:** the app shell, the last-loaded seat map, student list and fees list (cached on the phone).
- **Saved and sent later when offline:** record payment, check-in, add expense, send-reminder log, and quick student add. Each action gets an ID on the phone, so if it's retried it's never recorded twice.
- **Needs internet:** admitting with seat assignment, because two staff could grab the same seat while offline. If offline, the app says "Internet nahi hai, seat abhi confirm nahi ho sakti" and keeps the form filled so nothing is lost.

**Trade-off:** full offline-everything (a local database that syncs) would be a big, fragile system. This covers 90% of real desk moments with a small fraction of the risk.

### 2.8 Roles become plain-language permissions

The database has three staff roles (owner, manager, desk) plus permission flags on each membership. The owner never sees the word "role". When adding staff he answers questions like:

- "Kya ye total kamai dekh sakte hain?" (Can they see total earnings?)
- "Kya ye discount de sakte hain?" (Can they give a discount?)
- "Kya ye student hata sakte hain?" (Can they remove students?)

Presets: *Manager-jaisa* and *Desk-jaisa*, adjustable. Every rule is enforced by Row Level Security in Postgres, so a desk user can't fetch earnings even by tinkering with the app.

There's also a hidden **platform admin** flag (for Priyanshu) that unlocks Excel upload and support tools across libraries. It's never visible to owners.

### 2.9 Language

Hindi is the default and is shown first on the very first screen. The choice is stored per user (not in the URL, so links stay clean). Every string lives in `messages/hi.json` and `messages/en.json` from the first commit. Hindi is written the way people talk in Munger: "Fees baaki hai", "Seat khaali", "Plan 5 दिसंबर को khatam" — keeping English words like seat, fees and plan as they are.

> I'll write natural Hindi, but a native speaker from Bihar (your friend or his staff) should read every screen once in phase 6. I'll produce a single review sheet for that.

### 2.10 Receipts

Generated on the server as a **PNG image** (best for WhatsApp, which everyone opens) using Next's built-in image renderer with Devanagari fonts embedded. A PDF version comes from the same layout for anyone who asks. Every receipt has a private share link that can't be guessed.

Receipt numbers are sequential per library (`DL-2026-00231`), handed out by the database under a lock so two desks never get the same number.

---

## 3. Architecture

```
Phone / desktop browser (installable PWA)
   │  Server Components for reads, Server Actions for writes
   ▼
Next.js on Vercel (Mumbai, bom1)
   │  @supabase/ssr — user's session, RLS applies to every query
   ▼
Supabase (Mumbai, ap-south-1)
   ├─ Postgres: tables + RLS + all-or-nothing functions + exclusion constraints
   ├─ Auth: phone OTP
   ├─ Storage: student photos, ID proofs, logos (private buckets, signed URLs)
   ├─ Realtime: seat map + Today screen update live
   └─ pg_cron: nightly jobs (mark expired, create next invoices, expiring-soon flags)
```

- The service-role key is used **only** in the seed script and nightly jobs, never in code that reaches the browser.
- Active library is stored in a cookie. A user in two libraries gets a small switcher in More.

---

## 4. Folder structure

```
/
├─ PLAN.md, PROGRESS.md, README.md
├─ messages/              hi.json, en.json
├─ public/                icons, splash, manifest assets
├─ supabase/
│  ├─ migrations/         numbered SQL files (schema, RLS, functions, cron)
│  ├─ tests/              pgTAP tests: RLS, cross-library leaks, seat clashes
│  ├─ seed/               seed.ts — Dream Library + a second "Test Library"
│  └─ config.toml
├─ src/
│  ├─ app/
│  │  ├─ (auth)/          welcome (language), login, verify
│  │  ├─ (setup)/setup/   onboarding wizard steps
│  │  ├─ (app)/           shell with tab bar / sidebar
│  │  │  ├─ today/
│  │  │  ├─ seats/
│  │  │  ├─ students/[id]/
│  │  │  ├─ fees/
│  │  │  ├─ more/         reports, expenses, staff, settings/*, help
│  │  │  └─ @sheet/       intercepted routes: admit, pay, renew (sheet on mobile, panel on desktop)
│  │  ├─ (student)/me/    student portal (phase 5)
│  │  ├─ checkin/[slug]/  QR check-in (phase 5)
│  │  ├─ r/[token]/       public receipt view
│  │  └─ api/receipts/[id]/image/
│  ├─ components/
│  │  ├─ ui/              design-system primitives
│  │  ├─ patterns/        StatCard, StudentRow, SeatTile, MoneyText, EmptyState…
│  │  └─ features/        seats/, admit/, fees/, students/, setup/
│  ├─ lib/
│  │  ├─ money.ts         paise, ₹ formatting, amount-in-words (en + hi)
│  │  ├─ dates.ts         IST helpers, billing-day renewals, "3 din se pending"
│  │  ├─ seats.ts         best-seat suggestion, shift overlap
│  │  ├─ fees.ts          proration, partial payments, dues
│  │  ├─ upi.ts           upi:// links and QR
│  │  ├─ whatsapp.ts      wa.me links, template fill
│  │  ├─ offline/         IndexedDB write queue
│  │  ├─ supabase/        server + browser clients, generated types
│  │  └─ schemas/         Zod schemas shared by client and server
│  ├─ actions/            Server Actions (thin: validate → call DB function)
│  └─ styles/             tokens.css, globals.css
└─ tests/
   ├─ unit/               Vitest
   └─ e2e/                Playwright, at 390px and 1440px
```

---

## 5. Database schema

Every business table has `id uuid`, `library_id`, `created_at`, `updated_at`, `created_by`. Soft deletes (`deleted_at`) on students and payments. RLS is on for every table.

### 5.1 Tables

| Table | Key columns | Notes |
|---|---|---|
| `libraries` | name, slug, address, city, geo, timezone, upi_id, whatsapp_number, logo_path, brand_color, receipt_prefix, settings jsonb | settings hold deposit amount, late fee, reminder days, etc. |
| `profiles` | user_id, full_name, phone, locale (`hi`/`en`), theme, is_platform_admin | one per login |
| `memberships` | user_id, library_id, role (`owner`/`manager`/`desk`), permissions jsonb, is_active | permissions: can_see_earnings, can_discount, can_delete, can_edit_settings |
| `zones` | name, sort_order, attributes jsonb (ac, girls_only, cabin) | |
| `seats` | label, zone_id, x, y, rotation, is_active, tags text[] | x/y on a grid; unique label per library |
| `shifts` | name, start_min, end_min, minutes int4range (generated), is_full_day, sort_order | |
| `plans` | name, shift_id, duration_months, duration_days, price_paise, is_active | either months or days |
| `students` | name, phone, alt_phone, photo_path, id_proof_path, exam_target, gender, address, guardian_phone, joined_on, status, notes, source, referred_by, user_id (phase 5) | phone unique per library |
| `subscriptions` | student_id, plan_id, seat_id, shift_id, start_date, end_date, period daterange (generated), shift_minutes int4range (copied), billing_day, price_paise, discount_paise, discount_reason, status, renewed_from_id | **exclusion constraint** below |
| `subscription_pauses` | subscription_id, from_date, to_date, reason | pausing pushes end_date out |
| `invoices` | subscription_id, student_id, amount_due_paise, due_date, status (`due`/`partial`/`paid`/`waived`), snoozed_until | paid amount is computed from payments |
| `payments` | invoice_id, student_id, amount_paise (negative for reversals), method, reference, received_by, received_at, receipt_number, reverses_payment_id, reversal_reason, client_op_id | insert-only; client_op_id makes offline retries safe |
| `receipt_counters` | library_id, year, last_number | locked row per library-year |
| `deposits` | student_id, amount_paise, status (`held`/`refunded`/`adjusted`), settled_at, note | |
| `message_templates` | key (welcome, reminder, expiring, receipt), locale, body | variables: {name} {amount} {due_date} {seat} {upi_link} {library} |
| `reminders` | student_id, invoice_id, channel, template_key, body, sent_at, sent_by | logged when WhatsApp is opened |
| `attendance` | student_id, check_in_at, check_out_at, method (`qr`/`manual`) | phase 5 UI, table now |
| `waitlist` | name, phone, desired_shift_id, desired_zone_id, status, note | phase 5 UI |
| `expenses` | category, amount_paise, spent_on, note | |
| `activity_log` | actor_id, action, entity, entity_id, before jsonb, after jsonb, undone_at | written by DB triggers, powers audit + undo |
| `leads` | (phase 5+) public-page enquiries, trial bookings | schema only |

### 5.2 The seat-clash rule

```sql
create extension if not exists btree_gist;

alter table subscriptions add constraint no_seat_clash
  exclude using gist (
    seat_id       with =,
    shift_minutes with &&,
    period        with &&
  ) where (status in ('active', 'upcoming', 'paused') and seat_id is not null);
```

A paused student keeps their seat. An expired or cancelled one frees it.

### 5.3 Security rules (RLS) in short

- Helper `has_library_access(library_id, permission default null)` checks the current user's active membership (and permission flag if given).
- **Desk:** read and insert on students, subscriptions, invoices, payments and attendance. No delete. Can't apply discounts (checked inside the DB function too).
- **Totals and reports** come only from functions that check `can_see_earnings`. Desk users can see one student's dues but never library-wide sums.
- **Students (phase 5):** can read only rows where `students.user_id = auth.uid()`.
- **Proof of isolation:** the seed creates a second library. pgTAP tests log in as each role in each library and confirm zero rows leak across.

### 5.4 Nightly jobs (pg_cron, 00:05 IST)

1. Subscriptions past `end_date` become `expired`; `upcoming` ones starting today become `active`.
2. For subscriptions ending within N days (default 5) that have auto-renew on, create next period's invoice.
3. Waitlist matching (phase 5).

### 5.5 Seed data

**Dream Library:** 60 seats (AC Hall 40, Girls Section 12, Cabins 8), 4 shifts, 3 plans, about 45 students with realistic Bihar names (Rahul Kumar, Priya Kumari, Aman Raj, Sneha Bharti...), mixed exam targets (BPSC, SSC CGL, NEET, Railway, Bank PO). Two months of payments, a mix of paid, partial and overdue invoices, a few plans expiring this week, and some attendance.
**Test Library:** small, used only to prove no data leaks between libraries.

---

## 6. Routes

| Route | Who | What |
|---|---|---|
| `/welcome` | everyone | Choose language: **हिंदी** / English (big buttons, Hindi first) |
| `/login`, `/login/verify` | everyone | Mobile number → 6-digit OTP |
| `/setup/[step]` | new owner | Onboarding wizard (profile, seats, shifts, plans, students, staff) |
| `/today` | staff | Home: money, dues, expiring, free seats, attention list |
| `/seats` | staff | Seat map, shift switch, heatmap, move seat |
| `/students`, `/students/[id]` | staff | List and profile |
| `/fees` | staff | Collect inbox: Overdue / Due today / This week |
| `/more` | staff | Reports, expenses, staff, settings, help |
| `/more/reports` | owner (earnings permission) | This month vs last, charts, profit, export |
| `/more/settings/*` | owner | Library profile, layout editor, shifts, plans, templates, staff, receipts, export |
| `@sheet/admit`, `@sheet/pay/[invoiceId]`, `@sheet/renew/[subId]` | staff | Sheets on mobile, side panels on desktop, deep-linkable |
| `/r/[token]` | anyone with link | Receipt view and download |
| `/me` | student | Phase 5 portal |
| `/checkin/[slug]` | student | Phase 5 QR check-in |

**Tabs (mobile):** Aaj · Seats · Students · Fees · More, with a floating **+** for: Naya student (Admit), Fees jama karein (Record payment), Check-in, Kharcha (Expense).

---

## 7. Design system: "calm, precise, warm"

### 7.1 Tokens (CSS variables, light and dark)

| Token | Values |
|---|---|
| Font | **Geist** for Latin (tabular numbers on all money and counts), **Noto Sans Devanagari** for Hindi, both via `next/font` (self-hosted, no layout shift) |
| Type scale | 13 / 15 / **17 (body)** / 20 / 24 / 32 / 40. Nothing important below 15 |
| Line height | 1.5 body; 1.6 for Devanagari (taller letters) |
| Spacing | 4pt base: 4, 8, 12, 16, 24, 32, 48 |
| Radius | input 10, card 14, sheet 20, pill full |
| Elevation | 1px borders first; one soft shadow for sheets and popovers only |
| Brand | Deep indigo `oklch(0.45 0.16 270)`, overridable per library |
| Neutrals | 12-step warm grey (a little warm so it doesn't feel clinical) |
| Semantic | success = Paid (green + ✓), warning = Due soon (amber + clock), danger = Overdue (red + !), info = Upcoming (blue + calendar), muted = Free (grey outline + empty dot) |
| Contrast | every text/background pair checked to WCAG AA in both themes |
| Motion | springs (stiffness 400, damping 30) for sheets and layout; 150–200ms ease-out fades; all off with `prefers-reduced-motion` |
| Touch | min 48px tall; primary button 56px on mobile, full width, in the thumb zone |

Status is **never color alone**: each one has an icon and a word, and seat tiles also use a pattern (striped = expiring, solid = occupied, outline = free, cross-hatch = inactive).

### 7.2 Component inventory

**Primitives (`ui/`):** Button (primary, secondary, ghost, danger; always with text), IconButton (only for non-critical actions, always labelled for screen readers), Input, PhoneInput (+91 fixed, 10-digit, numeric keypad), MoneyInput (₹, numeric keypad, en-IN grouping as you type), OtpInput (6 boxes, auto-read SMS where supported), Select, SegmentedControl, Switch (shown as a Yes/No choice in owner copy), Checkbox, Radio cards, DatePicker (Hindi month names), Sheet (bottom sheet mobile / panel desktop, same API), Dialog, Toast (with Undo), Tooltip, Avatar (photo or initials), Badge/StatusPill, Skeleton, Tabs, ProgressSteps, Command (palette).

**Patterns (`patterns/`):** AppShell (TabBar + Sidebar + FAB), PageHeader, StatCard, ShiftRings, MoneyText, RelativeDue ("3 din se pending"), StudentRow (with swipe and visible buttons), InvoiceRow, AttentionItem, EmptyState, ErrorState, OfflineBanner (with queued count), PermissionNotice, FirstUseHint (one-line, dismissible), StepSheet (multi-step form container), SuccessState.

**Features:** SeatMap (pan/zoom, shift switch, heatmap, drag-to-move), SeatTile, SeatSheet, LayoutBuilder (template → drag → label → tag), ShiftTimeline, PlanCards, AdmitFlow, SeatSuggestion, PaymentForm, UpiQrCard, ReceiptCard, WhatsAppComposer, BatchRemind, StudentProfile tabs, ReportsCharts, ExpenseForm, StaffInvite.

### 7.3 Every screen ships with all five states

Loading (skeleton matching the final layout), empty (one sentence + the next action), error ("Kuch gadbad hui, dobara try karein" + retry), offline (banner + queued actions), and no-permission ("Ye dekhne ki anumati owner se lein").

---

## 8. Business logic (unit-tested before the screens that use it)

| Module | What it does | Tests include |
|---|---|---|
| `dates.ts` | plan end dates with billing day, IST "today", relative due text | Jan 31 → Feb 28 → Mar 31; leap year Feb 29; payment at 23:59 and 00:01 IST |
| `fees.ts` | dues, partial payments, proration on plan change mid-period, pause extension | ₹600 paid as ₹200 + ₹400; Morning → Full Day on day 10; pause 7 days |
| `seats.ts` | best seat: same seat on renewal → near referrer → zone match → preferred tags → lowest label | full-day blocks all shifts; Morning + Evening share a seat fine |
| `money.ts` | paise ↔ ₹, en-IN grouping, words in lakh/crore (en + hi) | ₹1,20,000; ₹1,00,00,000; ₹0; reversals |
| `upi.ts`, `whatsapp.ts` | link building, encoding, template variables | Hindi text encoding, missing variables |

Plus pgTAP tests for RLS, the seat-clash constraint, receipt numbering under concurrency, and the money functions.

---

## 9. Phase plan

| Phase | Scope | You'll be able to... | You'll need to... |
|---|---|---|---|
| **0** | This plan | Approve or change direction | Read and say "go" |
| **1** | Next.js setup, design tokens + primitives, Supabase schema + RLS + seed, phone OTP login (test numbers), language picker, app shell (tabs, sidebar, FAB), empty-but-beautiful screens, Vercel deploy | Log in on your phone and see Dream Library's shell with real seeded counts | Create a Supabase project and a Vercel account (I'll give steps), paste 3 keys |
| **2** | Onboarding wizard, layout builder, Seats screen (map, sheet, move, realtime, heatmap), Students list + profile + pause/left, Admit flow | Admit a student in under 60 seconds | Try admitting 3 students, timing yourself |
| **3** | Invoices, payments, reversals, receipts (image/PDF), Collect inbox with swipe + buttons, batch remind, UPI QR, WhatsApp templates, renewals, nightly jobs | Collect and remind fees end to end | Give me the real UPI ID and WhatsApp number (or keep placeholders) |
| **4** | Today screen, Reports, expenses + profit, command palette, undo everywhere, activity log | See the morning picture in 3 seconds | — |
| **5** | QR attendance (rotating code), student portal, waitlist with auto-alert | Students check in and see their dues | Print the QR poster |
| **6** | Polish: motion, all states, Hindi review, dark mode, accessibility audit, performance, Playwright on every core flow, PWA install, real SMS provider | Hand it to your friend | Get the Hindi reviewed by a local; set up MSG91 + DLT (I'll give steps) |

**End-of-phase checklist (every phase):** app runs; Vitest + pgTAP + Playwright green; zero type and lint errors; every new screen checked at 390px and 1440px with screenshots; the "Dream Library owner walkthrough" (list every word, gesture or step he might not get, then fix it); `PROGRESS.md` updated; committed and pushed.

---

## 10. Quality targets

- First load under 2 seconds on a mid-range Android over 4G (tested with Lighthouse mobile throttling); initial JS under 150 KB gzipped; heavy screens lazy-loaded.
- Lighthouse mobile 95+ by phase 6; zero console errors.
- Keyboard navigable, visible focus rings, screen-reader labels, AA contrast, reduced motion respected.
- No secrets in the browser bundle (checked by a build step).

---

## 11. Questions for the owner (none block phase 1)

These change behaviour in phases 2–3. Placeholders work until then.

1. **Fee cycle:** does a student's month run from their joining date (5 Dec → 4 Jan), or does everyone pay on the 1st? *I've assumed joining date.*
2. **Mid-month plan change** (Morning → Full Day): does he charge the difference for remaining days, or start a fresh month? *I've assumed charge the difference.*
3. **Deposit:** refunded in cash when a student leaves, or adjusted against the last month? *Both will be supported; which is the default?*
4. **Girls Section:** should the app stop a male student from being assigned there, or just warn? *I've assumed warn.*
5. Real seat layout: a phone photo of the hall (or a hand sketch) lets me pre-build his exact map for onboarding.

---

## 12. Not in v1 (deliberately)

Payment gateway auto-confirmation, WhatsApp Business API auto-sending, public library website, multi-branch chains, native Android app (the PWA installs like one). The schema leaves room for all of them.

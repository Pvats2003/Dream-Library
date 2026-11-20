# LibraryOS

Seats, students and fees for self-study libraries in India. Phone-first, Hindi-first.
See [PLAN.md](PLAN.md) for the design and [PROGRESS.md](PROGRESS.md) for what's built.

## Run it locally

Needs Node 22+ and Docker.

```bash
npm install
npx supabase start          # local Postgres, auth, storage
cp .env.example .env.local  # then fill from `npx supabase status -o env`
npx supabase db reset       # apply migrations
npm run db:seed             # Dream Library + Test Library
npm run dev                 # http://localhost:3000
```

### Test logins (OTP is always `123456`)

| Who | Mobile |
|---|---|
| Owner | 99999 00001 |
| Manager | 99999 00002 |
| Desk staff | 99999 00003 |
| Owner of the other (test) library | 99999 00009 |
| Platform admin (Priyanshu) | 99999 00010 |

These are configured in `supabase/config.toml` under `[auth.sms.test_otp]`; no SMS is sent.

## Checks

```bash
npm run typecheck && npm run lint
npm test              # unit tests (Vitest)
npm run test:db       # database security tests (pgTAP, needs supabase running)
npm run test:e2e      # browser tests (Playwright, needs supabase running + seeded)
```

If Playwright can't find its browser on a machine with a pre-installed Chromium, set `PW_CHROMIUM_PATH`.

## Layout

```
supabase/migrations   schema, security rules, database functions
supabase/tests        pgTAP security tests
supabase/seed         realistic seed data
src/app               routes: (auth) welcome + login, (app) Today/Seats/Students/Fees/More
src/lib               money, dates, phone, templates, data loaders, session
src/components        ui primitives, patterns, feature components
messages              hi.json, en.json — every string on screen
```

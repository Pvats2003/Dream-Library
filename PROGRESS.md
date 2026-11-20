# Progress

## Phase 1: Foundation (20–21 Nov 2026)

**Goal:** log in and see the seeded library in a calm, finished-looking shell.

### What you can do now
- Open the app → pick **हिंदी** or English → enter mobile number → enter the 6-digit code → you're in.
- **आज (Today):** today's collection, fees pending, fees due this week, free seats per shift (rings with shift timings), how many students are enrolled.
- **सीट (Seats):** the real seat layout per zone (AC Hall, Girls Section, Cabins), switchable by shift. Free, taken, ending soon, fees pending and closed seats each look different (fill, stripes, dashed outline, icon), so it works without relying on colour.
- **स्टूडेंट (Students):** everyone, searchable by name, phone or seat, with a clear status for each.
- **फीस (Fees):** who owes money, grouped into Pending / Due today / This week, with "28 दिन से बाकी" style wording and a Call button.
- **और (More):** language, light/dark, library switcher (if you work in more than one), log out.
- Desk staff see counts but **never rupee totals** on the Today screen. This is enforced in the database, not just hidden on screen.

### Under the hood
- Next.js 16 + Tailwind 4 + Supabase. Full multi-library database with security rules on every table.
- **Seat clashes are impossible:** the database rejects two students on one seat with overlapping hours and dates. A Full Day student automatically blocks every shift.
- Payments can't be edited or deleted, only reversed (reversals come in phase 3).
- Every change is recorded in an activity log (this will power Undo in phase 4).
- Seed data: Dream Library with 60 seats, 4 shifts, 5 plans, 45 students, 2 months of payments, attendance and expenses, plus a "Test Library" to prove no data leaks between libraries.

### Tests
| Suite | Result |
|---|---|
| Unit (Vitest): dates incl. 31 Jan → 28 Feb → 31 Mar, IST midnight, ₹ formatting, lakh/crore in words (EN + HI), phone numbers, Hindi/English text parity | 35 passed |
| Database (pgTAP): cross-library isolation, desk limits, seat clashes, payment immutability, no self-promotion to admin | 24 passed |
| Browser (Playwright, phone + desktop): welcome → OTP login → every tab; wrong code; wrong number; desk sees no ₹; log out | 12 passed |
| Type check, lint, production build | clean |
| Console errors across all screens (390px and 1440px) | none |

### Owner walkthrough (as the Dream Library owner) — what I changed
| Found | Fix |
|---|---|
| Seat map ran off the right edge on a phone | Seats now shrink to fit the screen; the aisle is drawn narrow |
| Desk staff saw "आज की कमाई 0", which reads like money | Desk sees "आज के पेमेंट" instead |
| Desk saw the same number twice ("9" above "9 स्टूडेंट") | Shows the number once with the word "स्टूडेंट" |
| Ring captions "26 / 59" were unclear | Ring shows free seats; caption shows the shift hours ("6 am – 12 pm"); total seats in the header |
| Student and fee rows cut off the end date | Details split across two short lines |
| "Good evening" shown after midnight | Late night now just says "नमस्ते" |

### Known gaps (deliberately not built yet)
- Tapping a seat, student or fee row does nothing yet. Seat sheet, student profile and admit come in **phase 2**; recording payments and WhatsApp reminders in **phase 3**. The floating **+** button is hidden until those exist.
- Shift and plan names ("Morning", "Full Day") are the owner's own data, so they appear as typed. He can rename them in Hindi from the setup wizard (phase 2).
- The Help button in More is hidden until `NEXT_PUBLIC_SUPPORT_WHATSAPP` (Priyanshu's number) is set.
- The app isn't installable (PWA) yet; that's phase 6.
- Real SMS: local and test logins use fixed test numbers. Before real use we connect MSG91 or Twilio with DLT registration (see PLAN.md §2.2).

# Progress

## Phase 2: Admit, seats, students, setup (21 Nov 2026)

**Goal:** admit a student in under 60 seconds on a phone.

### What you can do now
- **नया स्टूडेंट (admit):** a big button floating above the tabs (sidebar on desktop) opens a 5-step sheet:
  1. Mobile number first. If the number is already a student, it says so and offers **"इनका प्लान आगे बढ़ाएँ"** (renew) instead of making a duplicate. Someone who left earlier comes back with their history intact.
  2. Name, boy/girl, exam (one-tap chips), optional camera photo and ID photo (shrunk to ~40 KB so it uploads on weak 4G).
  3. Plan cards with shift timings and price; start today, tomorrow or a chosen date.
  4. **Best free seat** suggested: their old seat on renewal, then the right zone (boys are never suggested the Girls Section), then seats already shared by another shift so whole seats stay free for Full Day students. Or pick on a mini map, or no seat for now.
  5. Fees: paid in full / paid some / later, UPI or cash, security deposit yes/no, discount only for people allowed to give one (with a reason).
  6. Done: seat, dates, receipt number (DL-2026-00083 style), and **"WhatsApp पर स्वागत संदेश भेजें"** with the welcome message already filled in.
- **Seats:** tap any seat to see who sits there in each shift, their plan end date and dues, with Call / WhatsApp / Profile. **सीट बदलें** (change seat) highlights only seats free in that student's shift, and the new seat pulses. **सीट खाली करें** (free this seat). Both have **वापस करें** (undo). A free shift on a seat offers "इस सीट पर नया स्टूडेंट".
- **Live:** when the desk admits someone, the owner's seat map updates by itself within about a second.
- **30-day usage view:** each seat shows what % of opening hours it was booked over the last 30 days, which shows the dead seats.
- **Student profile:** photo, status, dues, current plan with days left, **pause** for 7/15/30 days (the end date moves out by the same days; resume early gives them back), and tabs for details, payments with receipt numbers, attendance with hours, notes, and change history (owner/manager). Edit details; **लाइब्रेरी छोड़ दी** (left) frees the seat, settles the deposit and keeps all history (owner/manager only).
- **Setup wizard** for a new library: name → seat layout builder (rows × seats per row, walkway, A1/B1 or G1/G2 numbering, girls-only / AC / cabin, tap seats in the preview to remove pillars) → shifts with a timeline → fee plans → UPI ID, WhatsApp, deposit → staff by mobile number with plain questions ("क्या ये कुल कमाई देख सकते हैं?"). Every step is pre-filled and skippable. The owner can reopen it from **और → लाइब्रेरी सेटअप बदलें**.

### Under the hood
- Admit, renew, move, free a seat, pause/resume, mark as left and create library are each one all-or-nothing database function. An admit that fails part-way leaves nothing behind, and an admit sent twice on a weak connection is saved once.
- Receipt numbers are handed out by the database under a lock, so they never repeat even if two desks collect at the same moment.
- Student photos sit in a private storage folder per library; links expire after an hour.
- Live updates go through the same security rules as everything else.

### Tests
| Suite | Result |
|---|---|
| Unit (Vitest): + seat availability and suggestion, layout builder (labels, walkway, removed seats, reading an existing hall back) | 51 passed |
| Database (pgTAP): + admit, idempotent retry, duplicate phone, seat clash, desk discount blocked, overpayment blocked, receipt sequence, renew keeps seat and date, pause/resume, mark as left, new library + layout, owner adds staff | 54 passed (local **and** on the live database) |
| Browser (Playwright, phone + desktop): + admit end to end with receipt, existing number offers renewal, seat move + undo, profile tabs, desk can't mark as left or open setup, owner opens setup | 26 passed |
| Type check, lint, production build | clean |

The automated admit takes about 1.7 s, so the only real limit on the 60-second goal is typing speed. The full walkthrough as a new owner took about 6 s automated.

### Owner walkthrough — what I changed
| Found | Fix |
|---|---|
| Adding staff failed (a database permission problem) | Fixed, with a test so it can't come back |
| Two identical "नया स्टूडेंट" buttons on the desktop Students page | Kept one |
| Layout preview ran off a phone screen | Preview shrinks to fit |
| Live map didn't update (it connected before the login was attached) | Connects as the logged-in person; ~0.8 s to update |

### Known gaps
- Recording a payment against an existing fee, receipts as images, UPI QR, WhatsApp reminders and automatic renewal invoices are **phase 3**. Until then fees can be taken at admission or renewal only.
- Seat tags (window, charging point) are shown but can only be edited in a later settings screen.
- The layout builder works on a rows × seats grid with removable seats; free-form dragging of individual seats wasn't built. Real reading rooms are grids, and tapping is easier than dragging on a phone.
- A staff member added by phone can log in only once real SMS is set up, or if their number is added as a Supabase test number.

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

### Live
- App: https://libraryos-theta.vercel.app (Vercel, server in Mumbai)
- Database: Supabase project `enqmocctaonzgkszpbnl` (Mumbai, Postgres 17). All 3 migrations applied, sample data loaded, and the 24 security tests pass against it.
- Verified on the live site: owner and desk OTP login, every tab at phone and desktop widths, desk sees no ₹ totals, no console errors.
- Test logins on the live site: 99999 00001 / 00002 / 00003 with code 123456 (valid until 30 Dec 2027; **remove before real data goes in**).

### Known gaps (deliberately not built yet)
- Tapping a seat, student or fee row does nothing yet. Seat sheet, student profile and admit come in **phase 2**; recording payments and WhatsApp reminders in **phase 3**. The floating **+** button is hidden until those exist.
- Shift and plan names ("Morning", "Full Day") are the owner's own data, so they appear as typed. He can rename them in Hindi from the setup wizard (phase 2).
- The Help button in More is hidden until `NEXT_PUBLIC_SUPPORT_WHATSAPP` (Priyanshu's number) is set.
- The app isn't installable (PWA) yet; that's phase 6.
- Real SMS: local and test logins use fixed test numbers. Any other number gets "कोड नहीं भेज पाए" because the SMS provider is a placeholder. Before real use we connect MSG91 or Twilio with DLT registration (see PLAN.md §2.2).

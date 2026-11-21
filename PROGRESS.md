# Progress

## Phase 3: Fees, receipts, UPI and WhatsApp (21 Nov 2026)

**Goal:** collect and remind fees end to end.

### What you can do now
- **फीस (Fees)** is now the collection screen: **बाकी है** (overdue) / **आज देनी है** (due today) / **इस हफ़्ते** (this week), plus **जल्द खत्म होने वाले प्लान** (plans ending soon). Every row has big labelled buttons: **पैसे मिले** (got paid), **याद दिलाएँ** (remind), and ⋮ to hide it for 1, 3 or 7 days. Shortcuts for quick hands: drag right = got paid, drag left = remind, long-press = hide for a few days. A one-time tip explains them.
- **Taking money:** the amount is filled in (it can be changed for part payments), with UPI / नकद (cash) / कार्ड (card) / बैंक (bank). **"UPI QR दिखाएँ"** shows a QR for the exact amount that the student scans at the desk, plus an optional UPI reference number. Afterwards: the receipt number, **"WhatsApp पर रसीद भेजें"** (send receipt), and **"रसीद देखें"** (view receipt).
- **Receipt page** (anyone with the link, no login): library name and address, receipt number, student (last 4 digits of their phone only), plan, period, seat, method, who received it, the amount in figures and in words ("एक हज़ार दो सौ रुपये मात्र"), and whether the period is fully paid. **"फ़ोटो की तरह भेजें"** turns it into a picture on the phone (so Hindi looks right) for sharing on WhatsApp; **"PDF / प्रिंट"** saves a PDF.
- **Reminders:** the WhatsApp text picks gentle wording up to 3 days late and firmer after that, fills in the name, amount, date and seat, and includes a **pay link**. The pay link opens a page with the amount, a UPI QR, an "open UPI app" button and "tell the library on WhatsApp". Every reminder is logged.
- **Remind several people:** tick students, then tap once per person (phones block opening many WhatsApp chats at once).
- **Renew in one tap** from "plans ending soon": same plan and same seat (if someone else has taken the seat for the next period, it renews without a seat and says so), then it asks for the money straight away.
- **Automatic next-month fees:** every night at 00:05 IST the app ends finished plans, starts next periods, ends pauses, and **creates next period's fee 3 days before a plan ends**, so it appears in "इस हफ़्ते".
- **Student profile → पेमेंट:** "पैसे लें" (collect) on any pending fee, a receipt link on every payment, and for owner/manager **"गलती सुधारें"** (fix a mistake), which cancels a payment with a reason. Nothing is erased; the cancelled entry stays visible, crossed out, and its receipt says it was cancelled.
- **और → WhatsApp संदेश** (owner): edit every message in Hindi and English. Fields appear as **[नाम]**, **[रकम]**, **[पैसे भेजने का लिंक]** and are added with buttons, with a WhatsApp-style preview.

### Decisions
- **Receipt picture is made on the phone, not the server.** The server image tool can't join Hindi letters correctly (matras and half-letters break). The phone's browser draws Hindi perfectly, so it makes the picture.
- **No undo on payments.** Money needs a deliberate confirmation (the big green "₹600 मिल गए" button) rather than an undo toast. Fixing a mistake is the owner/manager-only cancel with a reason.

### Tests
| Suite | Result |
|---|---|
| Unit | 64 passed (+7: UPI links, WhatsApp links with Hindi, reminder wording) |
| Database | 100 passed (+24: payment + receipt numbers, retry safety, no overpaying, paid fee can't be paid again, desk can't cancel, cancel needs a reason and works once, public receipt/pay pages, nightly renewals and expiry), local **and** live |
| Browser | 42 passed (+10: desk collects → public receipt; reminder → pay link works; overpaying blocked; desk can't cancel; owner edits a message) |
| Type check, lint, production build | clean |

### Known gaps
- Reminders still open WhatsApp for staff to press send. Fully automatic sending needs the WhatsApp Business API (paid, needs Meta approval); planned for later.
- UPI payments are confirmed by staff tapping "पैसे मिल गए". Automatic confirmation needs a payment gateway such as Razorpay; planned for later.

## Moving existing students in: QR self-registration (21 Nov 2026)

**Goal:** the owner shouldn't have to type every existing student by hand.

### How it works
1. **और → स्टूडेंट से जानकारी भरवाएँ** shows a QR poster. Print it for the desk, or send the link on WhatsApp with one tap. Copy link and "make a new link" (old posters stop working) are there too.
2. **The student scans it on their own phone.** No login, no app. It's a Hindi-first form (with an English switch) asking: name, mobile, boy/girl, which shift, seat number if they know it, **"आख़िरी बार फीस कब दी?"** (when they last paid) if they remember, and their exam. They see "धन्यवाद, आपकी जानकारी भेज दी गई".
3. **Aaj and Students show "3 नए अनुरोध"** (3 new requests). The inbox flags anything to check: the number is already a student, the seat number doesn't exist or is someone else's, no fee date, the plan has already ended, or two students claim the same seat (the earlier request keeps it).
4. **One tap: "सब ठीक वाले पक्का करें"** (confirm all that look right) adds every clean request at once. The others open a card where the owner fixes the plan, start date, seat and any fees still pending, then confirms. Requests can also be removed.
5. **"खुद जोड़ें"** (add myself) uses the same card for students who can't fill the form.

### Money rule
Fees paid **before** the app are stored as an "opening" amount. They make the plan show as paid (or part-paid, with the pending amount in Fees), but they are **not** payments: they never appear in "आज की कमाई", reports or receipt numbers. Paying the rest later counts both parts.

### Safety
- Only the library's own staff can read requests. A visitor, or another library, sees nothing.
- The form never says whether a number is already a student (so nobody can check who studies there).
- 5 sends per number per day, 500 waiting per library. Sending again replaces the earlier request.
- Nothing enters the records until staff confirm it.

### Also fixed
- Deleting a whole library was blocked by the "a library needs an owner" rule. That's also why the sample-data reset had been failing quietly. Fixed, with a test.

### Tests
| Suite | Result |
|---|---|
| Unit | 57 passed (+6: request checks, plan dates, seat claimed twice) |
| Database | 76 passed (+22: public form, privacy, spam limit, approval, opening amounts, library deletion), local **and** live |
| Browser | 32 passed (+6: student fills form logged-out → owner confirms; wrong link; add by hand doesn't change earnings) |
| Type check, lint, production build | clean |

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

## Design Step 1 — tokens, type and Design Lab (2026-11-21)

- `src/styles/tokens.css`: deep indigo brand, 12-step warm neutral, amber lamp accent (rare), status colours paid / due soon / overdue / upcoming / free, deliberate light and charcoal-indigo dark. Every text pair is AA-checked by `tests/unit/contrast.test.ts` in both themes.
- Fonts: Geist (tabular numbers) + Noto Sans Devanagari for everything; Fraunces + Tiro Devanagari Hindi only for greetings and the receipt title (not preloaded). Hindi line height 1.6.
- Design Lab at `/dev/design` (signed-in, noindex): every token and primitive in every state, light/dark, Hindi/English.
- Two review rounds (10 + 10 fixes): e.g. focus ring no longer changes shape, spinner replaces the icon while loading, solid-disc toast icons, empty shift ring shows no dot, clearer seat/status labels, type samples wrap instead of cutting off on phones.
- Screenshots: `docs/screenshots/design-lab-{390,1440}-{light,dark}-{hi,en}.png`.
- Checks: typecheck, lint, 131 unit tests, 42 e2e tests pass; no console errors or sideways scroll at 390/1440.

## Design Steps 2–4 — signature screens, delight, layouts (2026-11-21)

**Seat map:** desk-and-chair tiles (free = dashed outline, taken = solid with initials, ending soon = stripes, fees pending = red edge + badge, closed = cross-hatch); zone cards with an occupancy ring; shift switcher with a sliding spring indicator; tiles settle in with a spring on shift change; a seat changed by someone else pulses once; bigger/smaller seat size with pan inside each zone; soft lamp glow at night; seat sheet shows state as icon + word. The live connection loads after the map (Seats JS 258 → ~180 KB).

**Today:** "शुभ संध्या, Rajesh जी" in the serif face with the Hindi date; three big counting-up numbers (collection, fees pending, free seats); "ध्यान दें" list (late fees, plans ending this week) with one Remind button each; a self-drawing check when all of the week's fees are in; seats-free ring per shift.

**Receipt:** library colour band with monogram, serif title, amount in figures and Hindi words, paid/owed badge, seat + shift (new `get_receipt.shift_name`, migration 0007, applied locally and on hosted), validity, method, "LibraryOS से बनी रसीद" footer. Shared photo checked with क्षि, श्री, स्त — renders correctly (html-to-image).

**Admit:** big 56px keypads on phones for mobile number and ₹; sheet opens with a real spring (stiffness 400, damping 30, as CSS `linear()`); Enter moves on from any step on desktop; "सीट मिल गई!" with the seat tile dropping into place.

**Delight:** hand-drawn sleepy owl / book stack / empty desk (3 KB together) with one sentence and one action; skeletons shaped like the final screens; optional buzz + soft tick on payment (More → off by default); all motion off with reduce-motion.

**Layouts:** phones keep bottom tabs + floating "+"; desktop Students = list left, profile right; desktop Fees = inbox left, details panel right; More capped to a readable width; checked at 768px.

**Review rounds** (2 × 10 fixes): 48px seat tiles by default, 48px row buttons, no cut-off text in lists, stronger selected state in dark switches, label sizes ≥15px (pills, tabs), seat map no longer pushes the page sideways, initials balanced with seat numbers, etc.

**Owner walkthrough fixes:** "लाइव" → "अपने-आप ताज़ा", "टिप" → "सुझाव", "PDF / प्रिंट" → "प्रिंट / सेव करें", "UPI रेफ़रेंस" → "UPI वाला नंबर", "लॉग आउट" → "बाहर निकलें (लॉग आउट)", ⋮ → "बाद में", seat-size buttons get the word "साइज़", seat hint explains the initials.

**Checks:** typecheck, lint, 131 unit tests (incl. contrast), 42 e2e tests pass. Lighthouse mobile (production build): Welcome 99/100/100, Today 97/100/100, Seats 95/100/100, Students 99/100/100, Fees 81/100/96 (its "largest paint" is the one-time swipe tip; the list itself paints at ~1 s). Initial JS: Today ~149–158 KB gzipped (unchanged by the redesign; ~150 budget), Welcome 164 KB and Fees 200 KB were already above budget before this work.

**Screenshots:** `docs/screenshots/` — every screen at 390 and 1440, light and dark, Hindi and English, plus 768 for the main tabs, the admit steps and the shared receipt photo.

## Data download (backup) — 2026-11-21

- More → "डेटा डाउनलोड करें (बैकअप)", **owners only** (it has every student's number and all money records; desk/manager get "403" from the download address too).
- **Excel** (`/export/all.xlsx`): one tab each for स्टूडेंट, प्लान, फीस, पेमेंट, हाज़िरी, सीट. Bold frozen header with filters; rupees are real numbers (so totals work), dates are real dates, mobile numbers stay text. Built on the server with ExcelJS, so phones download no extra code.
- **CSV** (`/export/<part>.csv`): the same six parts separately, UTF-8 with BOM so Hindi opens correctly in Excel and Google Sheets.
- Reads go through the logged-in owner's own access (same database security rules as every screen), 1000 rows at a time so big libraries are complete.
- Any text starting with = + - @ is defused so a name typed into the public QR form can never run as an Excel formula.
- Tests: 5 unit (CSV format, Hindi, formula safety, rupees, time zone, file names) + 2 e2e (owner downloads and opens the Excel file; desk can't see or open it).
- Note: ExcelJS pulls an old `uuid` with a "moderate" advisory that only applies to a way of calling it ExcelJS doesn't use.

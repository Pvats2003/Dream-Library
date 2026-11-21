/**
 * Seeds a realistic Dream Library (Munger, Bihar) plus a small "Test Library"
 * used to prove that no data leaks between libraries.
 *
 *   npm run db:seed
 *
 * Needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DATABASE_URL (defaults
 * point at the local stack). Safe to re-run: it deletes and recreates both
 * libraries. Never run against production data.
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { addDays, dateInTz, planPeriod, todayInTz, type ISODate } from "../../src/lib/dates";
import { rupees } from "../../src/lib/money";
import { DEFAULT_TEMPLATES } from "../../src/lib/templates";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

if (!SERVICE_KEY) {
  console.error("Set SUPABASE_SERVICE_ROLE_KEY (see .env.example).");
  process.exit(1);
}

// Test logins. They must match [auth.sms.test_otp] in supabase/config.toml
// (or the test phone numbers configured in the hosted Supabase dashboard).
export const TEST_USERS = {
  owner: { phone: "+919999900001", name: "Dream Library Owner" },
  manager: { phone: "+919999900002", name: "Ravi (Manager)" },
  desk: { phone: "+919999900003", name: "Sonu (Desk)" },
  otherOwner: { phone: "+919999900009", name: "Test Library Owner" },
  platformAdmin: { phone: "+919999900010", name: "Priyanshu" },
} as const;

// Deterministic randomness so every seed looks the same.
let state = 20261120;
function rand(): number {
  state = (state * 1664525 + 1013904223) % 4294967296;
  return state / 4294967296;
}
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

const MALE = [
  "Rahul Kumar", "Aman Raj", "Vikash Kumar", "Sonu Kumar", "Abhishek Anand", "Rohit Ranjan",
  "Saurabh Singh", "Nitish Kumar", "Ankit Raj", "Deepak Yadav", "Manish Kumar", "Pankaj Mandal",
  "Shubham Jha", "Ravi Shankar", "Gaurav Mishra", "Amit Paswan", "Prince Raj", "Raushan Kumar",
  "Sachin Sah", "Vivek Pandey", "Kundan Kumar", "Chandan Singh", "Rajeev Ranjan", "Aditya Kumar",
  "Sunny Kumar", "Harsh Vardhan", "Md. Arif", "Md. Sajid", "Bittu Kumar", "Alok Kumar",
];
const FEMALE = [
  "Priya Kumari", "Sneha Bharti", "Anjali Kumari", "Khushi Raj", "Pooja Kumari", "Nikita Singh",
  "Shalini Jha", "Ritu Kumari", "Neha Bharti", "Kajal Kumari", "Sakshi Sinha", "Muskan Parveen",
  "Swati Mishra", "Komal Kumari", "Rani Kumari",
];
const EXAMS = ["BPSC", "SSC CGL", "NEET", "Railway NTPC", "Bank PO", "UPSC", "BSSC", "JEE", "CA Foundation", "Bihar Police", "College"];

type Ids = Record<string, string>;

async function ensureAuthUsers(): Promise<Record<keyof typeof TEST_USERS, string>> {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const out = {} as Record<keyof typeof TEST_USERS, string>;
  for (const [key, u] of Object.entries(TEST_USERS) as [keyof typeof TEST_USERS, (typeof TEST_USERS)[keyof typeof TEST_USERS]][]) {
    const digits = u.phone.slice(1);
    const existing = data.users.find((x) => x.phone === digits || x.phone === u.phone);
    if (existing) {
      out[key] = existing.id;
      continue;
    }
    const created = await admin.auth.admin.createUser({ phone: u.phone, phone_confirm: true });
    if (created.error) throw created.error;
    out[key] = created.data.user.id;
  }
  return out;
}

async function main() {
  const users = await ensureAuthUsers();
  const db = new pg.Client({ connectionString: DATABASE_URL });
  await db.connect();
  const q = async <T extends pg.QueryResultRow = pg.QueryResultRow>(sql: string, params: unknown[] = []) =>
    (await db.query<T>(sql, params)).rows;
  const one = async (sql: string, params: unknown[] = []) => (await q<{ id: string }>(sql, params))[0].id;

  const today = todayInTz();
  console.log(`Seeding for ${today} (IST)…`);

  try {
    await q("begin");
    await q("delete from public.libraries where slug in ('dream-library', 'test-library')");
    await q("update public.profiles set full_name = $2 where id = $1", [users.platformAdmin, TEST_USERS.platformAdmin.name]);
    await q("update public.profiles set is_platform_admin = true where id = $1", [users.platformAdmin]);
    for (const k of ["owner", "manager", "desk", "otherOwner"] as const) {
      await q("update public.profiles set full_name = $2 where id = $1", [users[k], TEST_USERS[k].name]);
    }

    // ---------------------------------------------------------------- library
    const lib = await one(
      `insert into public.libraries (name, slug, address, city, upi_id, whatsapp_number, brand_color, receipt_prefix, settings, setup_completed_at)
       values ('Dream Library', 'dream-library', 'Near Kasim Bazar', 'Munger, Bihar', 'library@upi', '+919999900001', '#3B3FB6', 'DL',
               $1, now()) returning id`,
      [JSON.stringify({ deposit_paise: rupees(500), late_fee_per_day_paise: 0, reminder_days: [7, 3, 1], open_min: 360, close_min: 1380 })],
    );

    for (const [k, role] of [["owner", "owner"], ["manager", "manager"], ["desk", "desk"]] as const) {
      await q(
        `insert into public.memberships (library_id, user_id, phone, display_name, role) values ($1, $2, $3, $4, $5)`,
        [lib, users[k], TEST_USERS[k].phone, TEST_USERS[k].name, role],
      );
    }

    // ---------------------------------------------------------------- zones & seats
    const zones: Ids = {};
    zones.ac = await one(
      `insert into public.zones (library_id, name, sort_order, attributes) values ($1, 'AC Hall', 1, '{"ac": true}') returning id`, [lib]);
    zones.girls = await one(
      `insert into public.zones (library_id, name, sort_order, attributes) values ($1, 'Girls Section', 2, '{"ac": true, "girls_only": true}') returning id`, [lib]);
    zones.cabin = await one(
      `insert into public.zones (library_id, name, sort_order, attributes) values ($1, 'Cabins', 3, '{"ac": true, "cabin": true}') returning id`, [lib]);

    type Seat = { id: string; label: string; zone: "ac" | "girls" | "cabin" };
    const seats: Seat[] = [];
    // AC Hall: rows A–E, 8 seats each, aisle in the middle (x = 4 is empty).
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        const label = `${"ABCDE"[r]}${c + 1}`;
        const tags = [
          ...(c === 0 || c === 7 ? ["window"] : []),
          ...(c % 2 === 0 ? ["charging"] : []),
          ...(r === 0 ? ["near_ac"] : []),
        ];
        const id = await one(
          `insert into public.seats (library_id, zone_id, label, x, y, tags) values ($1, $2, $3, $4, $5, $6) returning id`,
          [lib, zones.ac, label, c < 4 ? c : c + 1, r, tags],
        );
        seats.push({ id, label, zone: "ac" });
      }
    }
    // Girls Section: 2 rows of 6.
    for (let i = 0; i < 12; i++) {
      const label = `G${i + 1}`;
      const id = await one(
        `insert into public.seats (library_id, zone_id, label, x, y, tags) values ($1, $2, $3, $4, $5, $6) returning id`,
        [lib, zones.girls, label, i % 6, Math.floor(i / 6), i % 6 === 0 || i % 6 === 5 ? ["window", "charging"] : ["charging"]],
      );
      seats.push({ id, label, zone: "girls" });
    }
    // Cabins: 2 rows of 4.
    for (let i = 0; i < 8; i++) {
      const label = `CB${i + 1}`;
      const id = await one(
        `insert into public.seats (library_id, zone_id, label, x, y, tags) values ($1, $2, $3, $4, $5, $6) returning id`,
        [lib, zones.cabin, label, i % 4, Math.floor(i / 4), ["charging"]],
      );
      seats.push({ id, label, zone: "cabin" });
    }
    // One broken seat to show the "inactive" state.
    await q(`update public.seats set is_active = false where library_id = $1 and label = 'E8'`, [lib]);

    // ---------------------------------------------------------------- shifts & plans
    const shifts: Ids = {};
    const shiftDefs = [
      ["morning", "Morning", 360, 720, false, 1],
      ["evening", "Evening", 720, 1080, false, 2],
      ["night", "Night", 1080, 1380, false, 3],
      ["full", "Full Day", 360, 1380, true, 4],
    ] as const;
    for (const [key, name, s, e, full, order] of shiftDefs) {
      shifts[key] = await one(
        `insert into public.shifts (library_id, name, start_min, end_min, is_full_day, sort_order) values ($1, $2, $3, $4, $5, $6) returning id`,
        [lib, name, s, e, full, order],
      );
    }

    type Plan = { id: string; shift: keyof typeof shifts; months: number; price: number };
    const planDefs: [string, keyof typeof shifts, number, number][] = [
      ["Morning Monthly", "morning", 1, 600],
      ["Evening Monthly", "evening", 1, 600],
      ["Night Monthly", "night", 1, 500],
      ["Full Day Monthly", "full", 1, 1200],
      ["Full Day Quarterly", "full", 3, 3300],
    ];
    const plans: Record<string, Plan> = {};
    let order = 1;
    for (const [name, shift, months, price] of planDefs) {
      const id = await one(
        `insert into public.plans (library_id, name, shift_id, duration_months, price_paise, sort_order) values ($1, $2, $3, $4, $5, $6) returning id`,
        [lib, name, shifts[shift], months, rupees(price), order++],
      );
      plans[name] = { id, shift, months, price };
    }

    for (const t of DEFAULT_TEMPLATES) {
      await q(`insert into public.message_templates (library_id, key, locale, body) values ($1, $2, $3, $4)`, [lib, t.key, t.locale, t.body]);
    }

    // ---------------------------------------------------------------- students
    // Seat occupancy per shift, so the seed never tries to double-book.
    const SHIFT_SLOTS: Record<string, string[]> = {
      morning: ["morning"], evening: ["evening"], night: ["night"], full: ["morning", "evening", "night"],
    };
    const taken = new Set<string>(); // `${seatLabel}:${slot}`
    function findSeat(shift: string, zone: Seat["zone"]): Seat | null {
      const slots = SHIFT_SLOTS[shift];
      const candidates = seats.filter((s) => s.zone === zone && s.label !== "E8");
      // Part-time shifts prefer seats already shared, so the map shows sharing.
      const ordered = shift === "full" ? candidates : [...candidates].sort((a, b) => {
        const score = (s: Seat) => (["morning", "evening", "night"].some((sl) => taken.has(`${s.label}:${sl}`)) ? 0 : 1);
        return score(a) - score(b);
      });
      for (const s of ordered) {
        if (slots.every((sl) => !taken.has(`${s.label}:${sl}`))) {
          slots.forEach((sl) => taken.add(`${s.label}:${sl}`));
          return s;
        }
      }
      return null;
    }

    const names = [
      ...MALE.slice(0, 30).map((n) => ({ name: n, gender: "male" as const })),
      ...FEMALE.slice(0, 15).map((n) => ({ name: n, gender: "female" as const })),
    ].sort(() => rand() - 0.5);

    let receiptNo = 0;
    const payments: { invoice: string; student: string; amount: number; method: string; at: Date; by: string }[] = [];
    const staffIds = [users.owner, users.manager, users.desk];
    const methodPick = () => (chance(0.6) ? "upi" : chance(0.9) ? "cash" : "bank");

    // A moment on a given IST date at a given hour.
    const atIST = (iso: string, hour: number, minute = between(0, 59)) =>
      new Date(`${iso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+05:30`);

    let phoneSeq = 7000011000;
    const studentIds: string[] = [];
    const currentSubs: { student: string; shift: string; end: string }[] = [];

    for (let i = 0; i < names.length; i++) {
      const { name, gender } = names[i];
      const roll = rand();
      const planName =
        roll < 0.22 ? "Morning Monthly" : roll < 0.34 ? "Evening Monthly" : roll < 0.42 ? "Night Monthly" : roll < 0.84 ? "Full Day Monthly" : "Full Day Quarterly";
      const plan = plans[planName];
      const zone: Seat["zone"] = gender === "female" && chance(0.75) ? "girls" : planName === "Full Day Quarterly" && chance(0.7) ? "cabin" : "ac";
      const seat = findSeat(plan.shift, zone) ?? findSeat(plan.shift, "ac");

      // Story for this student.
      const story = i < 2 ? "left" : roll > 0.97 ? "partial" : i % 7 === 3 ? "overdue" : i % 11 === 5 ? "partial" : "paid";
      const isNew = i % 9 === 0; // joined within the current period

      // Current period: started some days ago so end dates spread over the next month.
      const daysAgo = plan.months === 3 ? between(5, 80) : story === "overdue" ? between(2, 12) : between(1, 29);
      const currentStart = addDays(today, -daysAgo);
      const billingDay = Number(currentStart.slice(8, 10));
      const current = planPeriod(currentStart, { months: plan.months }, billingDay);
      const joinedOn = isNew ? currentStart : addDays(currentStart, -between(31, 120));

      phoneSeq += between(137, 9973);
      const phone = `+91${phoneSeq}`;
      const student = await one(
        `insert into public.students (library_id, name, phone, gender, exam_target, joined_on, status, source, guardian_phone, created_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
        [lib, name, phone, gender, pick(EXAMS), joinedOn, story === "left" ? "left" : "active",
         pick(["walk_in", "walk_in", "referral", "referral", "instagram", "google", "whatsapp"]),
         chance(0.5) ? `+91${9000000000 + between(100000000, 999999999)}` : null, atIST(joinedOn, 10)],
      );
      studentIds.push(student);

      if (chance(0.85) && story !== "left") {
        await q(
          `insert into public.deposits (library_id, student_id, amount_paise, method, received_at) values ($1, $2, $3, $4, $5)`,
          [lib, student, rupees(500), methodPick(), atIST(joinedOn, 10)],
        );
      }

      // Previous period (history), if they joined before the current one.
      if (!isNew) {
        const prevStart = addDays(currentStart, -(plan.months === 3 ? 92 : 30));
        const prev = planPeriod(prevStart < joinedOn ? joinedOn : prevStart, { months: plan.months }, billingDay);
        const prevEnd = prev.end >= currentStart ? addDays(currentStart, -1) : prev.end;
        const sub = await one(
          `insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise, status)
           values ($1, $2, $3, $4, $5, 'empty', $6, $7, $8, $9, 'expired') returning id`,
          [lib, student, plan.id, seat?.id ?? null, shifts[plan.shift], prev.start, prevEnd, billingDay, rupees(plan.price)],
        );
        const inv = await one(
          `insert into public.invoices (library_id, student_id, subscription_id, amount_due_paise, due_date, period_start, period_end)
           values ($1, $2, $3, $4, $5, $5, $6) returning id`,
          [lib, student, sub, rupees(plan.price), prev.start, prevEnd],
        );
        payments.push({ invoice: inv, student, amount: rupees(plan.price), method: methodPick(), at: atIST(prev.start, between(7, 20)), by: pick(staffIds) });
      }

      if (story === "left") {
        await q(`update public.deposits set status = 'refunded', settled_at = now() where student_id = $1`, [student]);
        continue;
      }

      const sub = await one(
        `insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise, status)
         values ($1, $2, $3, $4, $5, 'empty', $6, $7, $8, $9, 'active') returning id`,
        [lib, student, plan.id, seat?.id ?? null, shifts[plan.shift], current.start, current.end, billingDay, rupees(plan.price)],
      );
      currentSubs.push({ student, shift: plan.shift, end: current.end });
      const inv = await one(
        `insert into public.invoices (library_id, student_id, subscription_id, amount_due_paise, due_date, period_start, period_end)
         values ($1, $2, $3, $4, $5, $5, $6) returning id`,
        [lib, student, sub, rupees(plan.price), current.start, current.end],
      );
      const paidAt = atIST(current.start, between(7, 20));
      if (story === "paid") {
        // Some pay in two parts.
        if (chance(0.15)) {
          const first = rupees(Math.round(plan.price / 2 / 100) * 100);
          payments.push({ invoice: inv, student, amount: first, method: "cash", at: paidAt, by: pick(staffIds) });
          payments.push({ invoice: inv, student, amount: rupees(plan.price) - first, method: methodPick(), at: atIST(addDays(current.start, between(3, 8)) > today ? today : addDays(current.start, between(3, 8)), between(7, 11)), by: pick(staffIds) });
        } else {
          payments.push({ invoice: inv, student, amount: rupees(plan.price), method: methodPick(), at: paidAt, by: pick(staffIds) });
        }
      } else if (story === "partial") {
        payments.push({ invoice: inv, student, amount: rupees(Math.min(500, plan.price - 100)), method: "cash", at: paidAt, by: pick(staffIds) });
      }
      // overdue: nothing paid yet.
    }

    // Payments in time order so receipt numbers increase with time.
    payments.sort((a, b) => a.at.getTime() - b.at.getTime());
    const nowMs = Date.now();
    for (const p of payments) {
      if (p.at.getTime() > nowMs) p.at = new Date(nowMs - between(1, 120) * 60_000);
      receiptNo += 1;
      const year = Number(dateInTz(p.at).slice(0, 4));
      await q(
        `insert into public.payments (library_id, invoice_id, student_id, amount_paise, method, reference, received_by, received_at, receipt_number, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $7)`,
        [lib, p.invoice, p.student, p.amount, p.method, p.method === "upi" ? `UPI${between(100000000, 999999999)}` : null, p.by, p.at,
         `DL-${year}-${String(receiptNo).padStart(5, "0")}`],
      );
    }
    await q(
      `insert into public.receipt_counters (library_id, year, last_number) values ($1, $2, $3)`,
      [lib, Number(today.slice(0, 4)), receiptNo],
    );

    // A few people asking for a seat.
    for (const [name, phone, shift] of [["Aryan Kumar", "+917004512345", "morning"], ["Simran Kumari", "+918210098765", "full"], ["Rajan Yadav", "+919006011223", "full"]] as const) {
      await q(`insert into public.waitlist (library_id, name, phone, desired_shift_id) values ($1, $2, $3, $4)`, [lib, name, phone, shifts[shift]]);
    }

    // Existing students who filled in the join form and are waiting for approval.
    for (const [name, phone, shift, seat, daysAgo, gender] of [
      ["Ritika Kumari", "+917061234501", "morning", "G9", 12, "female"],
      ["Sumit Raj", "+917061234502", "full", "E3", 20, "male"],
      ["Neeraj Yadav", "+917061234503", "evening", null, null, "male"],
    ] as const) {
      await q(
        `insert into public.join_requests (library_id, name, phone, gender, shift_id, seat_label, last_paid_on, exam_target)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [lib, name, phone, gender, shifts[shift], seat, daysAgo === null ? null : addDays(today, -daysAgo), pick(EXAMS)],
      );
    }

    // Attendance: the last 14 days.
    const SHIFT_HOURS: Record<string, [number, number]> = { morning: [6, 12], evening: [12, 18], night: [18, 23], full: [6, 23] };
    for (const s of currentSubs) {
      for (let d = 14; d >= 0; d--) {
        const day = addDays(today, -d);
        if (!chance(0.72)) continue;
        const [h0, h1] = SHIFT_HOURS[s.shift];
        const inAt = atIST(day, h0 + between(0, 1));
        const outAt = atIST(day, Math.min(h1 - 1, h0 + between(3, h1 - h0 - 1)));
        if (inAt.getTime() > nowMs) continue;
        await q(
          `insert into public.attendance (library_id, student_id, check_in_at, check_out_at, method) values ($1, $2, $3, $4, $5)`,
          [lib, s.student, inAt, outAt.getTime() > nowMs ? null : outAt, chance(0.8) ? "qr" : "manual"],
        );
      }
    }

    // Running costs.
    const monthStart = (offset: number): ISODate => {
      const [y, m] = today.split("-").map(Number);
      const z = y * 12 + (m - 1) + offset;
      return `${Math.floor(z / 12)}-${String((z % 12) + 1).padStart(2, "0")}-01` as ISODate;
    };
    for (const off of [-2, -1, 0]) {
      const ms = monthStart(off);
      const rows: [string, number, number, string][] = [
        ["rent", 15000, 1, "Building rent"],
        ["electricity", between(5200, 7400), 8, "Bijli bill"],
        ["internet", 999, 5, "Wi-Fi"],
        ["salary", 8000, 1, "Desk staff salary"],
        ["maintenance", between(300, 1500), 15, "AC service / safai"],
      ];
      for (const [cat, amt, day, note] of rows) {
        const on = addDays(ms, day - 1);
        if (on > today) continue;
        await q(`insert into public.expenses (library_id, category, amount_paise, spent_on, note, created_by) values ($1, $2, $3, $4, $5, $6)`,
          [lib, cat, rupees(amt), on, note, users.owner]);
      }
    }

    // ---------------------------------------------------------------- second library (leak tests)
    const other = await one(
      `insert into public.libraries (name, slug, city, setup_completed_at) values ('Test Library', 'test-library', 'Patna, Bihar', now()) returning id`,
    );
    await q(`insert into public.memberships (library_id, user_id, phone, display_name, role) values ($1, $2, $3, $4, 'owner')`,
      [other, users.otherOwner, TEST_USERS.otherOwner.phone, TEST_USERS.otherOwner.name]);
    const oShift = await one(`insert into public.shifts (library_id, name, start_min, end_min, is_full_day) values ($1, 'Full Day', 420, 1320, true) returning id`, [other]);
    const oPlan = await one(`insert into public.plans (library_id, name, shift_id, duration_months, price_paise) values ($1, 'Monthly', $2, 1, $3) returning id`, [other, oShift, rupees(900)]);
    const oSeat = await one(`insert into public.seats (library_id, label) values ($1, 'S1') returning id`, [other]);
    const oStudent = await one(`insert into public.students (library_id, name, phone) values ($1, 'Secret Student', '+916200000001') returning id`, [other]);
    const oSub = await one(
      `insert into public.subscriptions (library_id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, billing_day, price_paise)
       values ($1, $2, $3, $4, $5, 'empty', $6, $7, $8, $9) returning id`,
      [other, oStudent, oPlan, oSeat, oShift, today, planPeriod(today, { months: 1 }).end, Number(today.slice(8)), rupees(900)]);
    const oInv = await one(`insert into public.invoices (library_id, student_id, subscription_id, amount_due_paise, due_date) values ($1, $2, $3, $4, $5) returning id`,
      [other, oStudent, oSub, rupees(900), today]);
    await q(`insert into public.payments (library_id, invoice_id, student_id, amount_paise, method, receipt_number) values ($1, $2, $3, $4, 'cash', 'TL-1')`,
      [other, oInv, oStudent, rupees(900)]);

    // What the nightly job would have done: next month's fees for plans ending soon.
    await q(`select private.nightly($1)`, [lib]);

    // Start both audit trails clean.
    await q(`delete from public.activity_log where library_id in ($1, $2)`, [lib, other]);
    await q("commit");

    const [counts] = await q<{ students: string; subs: string; payments: string }>(
      `select (select count(*) from students where library_id = $1) as students,
              (select count(*) from subscriptions where library_id = $1 and status = 'active') as subs,
              (select count(*) from payments where library_id = $1) as payments`,
      [lib],
    );
    console.log(`Dream Library: ${counts.students} students, ${counts.subs} active plans, ${counts.payments} payments.`);
    console.log("Test logins (OTP 123456):");
    for (const [k, u] of Object.entries(TEST_USERS)) console.log(`  ${k.padEnd(14)} ${u.phone}`);
  } catch (e) {
    await q("rollback");
    throw e;
  } finally {
    await db.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

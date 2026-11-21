import "server-only";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { formatMobile } from "@/lib/phone";
import { localDateTime, rupees, type Sheet, type SheetKey, type Value } from "@/lib/export";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Reads every row, 1000 at a time (the database hands out at most 1000 per ask). */
async function all<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

function range(r: unknown): [number, number] | null {
  const m = /^[[(](\d+),(\d+)[)\]]$/.exec(String(r ?? ""));
  return m ? [Number(m[1]), Number(m[2])] : null;
}

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

/**
 * Everything a library owner would want in a backup, as ready-to-write
 * sheets. Uses the logged-in person's own access, so the database's
 * security rules decide what can be read, exactly as on every screen.
 */
export async function buildExport(libraryId: string, timezone: string, today: string, only?: SheetKey): Promise<Sheet[]> {
  const supabase: Client = await createClient();
  const t = await getTranslations("export");
  const want = (k: SheetKey) => !only || only === k;

  const [students, subs, invoices, payments, attendance, seats, zones, shifts, plans, members] = await Promise.all([
    all((a, b) =>
      supabase
        .from("students")
        .select("id, name, phone, alt_phone, guardian_phone, gender, exam_target, address, joined_on, status, source, notes")
        .eq("library_id", libraryId)
        .is("deleted_at", null)
        .order("name")
        .range(a, b),
    ),
    want("plans") || want("students")
      ? all((a, b) =>
          supabase
            .from("subscriptions")
            .select("id, student_id, plan_id, seat_id, shift_id, shift_minutes, start_date, end_date, price_paise, discount_paise, discount_reason, status")
            .eq("library_id", libraryId)
            .order("start_date")
            .range(a, b),
        )
      : Promise.resolve([]),
    want("fees")
      ? all((a, b) =>
          supabase
            .from("invoices")
            .select("student_id, period_start, period_end, due_date, amount_due_paise, amount_paid_paise, status, waived_reason")
            .eq("library_id", libraryId)
            .order("due_date")
            .range(a, b),
        )
      : Promise.resolve([]),
    want("payments")
      ? all((a, b) =>
          supabase
            .from("payments")
            .select("student_id, receipt_number, received_at, amount_paise, method, reference, received_by, reversal_reason")
            .eq("library_id", libraryId)
            .order("received_at")
            .range(a, b),
        )
      : Promise.resolve([]),
    want("attendance")
      ? all((a, b) =>
          supabase.from("attendance").select("student_id, check_in_at, check_out_at").eq("library_id", libraryId).order("check_in_at").range(a, b),
        )
      : Promise.resolve([]),
    all((a, b) => supabase.from("seats").select("id, label, zone_id, is_active").eq("library_id", libraryId).order("label").range(a, b)),
    supabase.from("zones").select("id, name").eq("library_id", libraryId),
    supabase.from("shifts").select("id, name").eq("library_id", libraryId),
    supabase.from("plans").select("id, name").eq("library_id", libraryId),
    supabase.from("memberships").select("user_id, display_name").eq("library_id", libraryId),
  ]);
  for (const r of [zones, shifts, plans, members]) if (r.error) throw r.error;

  const student = new Map(students.map((s) => [s.id, s]));
  const seat = new Map(seats.map((s) => [s.id, s]));
  const zone = new Map(zones.data!.map((z) => [z.id, z.name]));
  const shift = new Map(shifts.data!.map((s) => [s.id, s.name]));
  const plan = new Map(plans.data!.map((p) => [p.id, p.name]));
  const member = new Map(members.data!.map((m) => [m.user_id, m.display_name]));
  const who = (id: string) => student.get(id)?.name ?? "";
  const mobile = (p: string | null) => (p ? formatMobile(p) : null);
  const phone = (id: string) => mobile(student.get(id)?.phone ?? null);
  const label = (group: string, v: string | null) => (v ? (t.has(`${group}.${v}`) ? t(`${group}.${v}`) : v) : null);

  // Each student's current (or latest) plan, for the Students sheet.
  const current = new Map<string, (typeof subs)[number]>();
  for (const s of subs) {
    if (s.status === "cancelled") continue;
    const prev = current.get(s.student_id);
    const live = s.start_date <= today && s.end_date >= today;
    if (!prev || live || (s.end_date > prev.end_date && !(prev.start_date <= today && prev.end_date >= today))) current.set(s.student_id, s);
  }

  const sheets: Sheet[] = [];

  if (want("students")) {
    sheets.push({
      key: "students",
      title: t("sheet.students"),
      columns: [
        { header: t("col.name"), type: "text", width: 24 },
        { header: t("col.mobile"), type: "text", width: 15 },
        { header: t("col.altMobile"), type: "text", width: 15 },
        { header: t("col.guardian"), type: "text", width: 15 },
        { header: t("col.gender"), type: "text" },
        { header: t("col.exam"), type: "text" },
        { header: t("col.seat"), type: "text" },
        { header: t("col.shift"), type: "text" },
        { header: t("col.planEnds"), type: "date" },
        { header: t("col.joined"), type: "date" },
        { header: t("col.status"), type: "text" },
        { header: t("col.source"), type: "text" },
        { header: t("col.address"), type: "text", width: 30 },
        { header: t("col.notes"), type: "text", width: 30 },
      ],
      rows: students.map((s): Value[] => {
        const c = current.get(s.id);
        return [
          s.name,
          mobile(s.phone),
          mobile(s.alt_phone),
          mobile(s.guardian_phone),
          label("gender", s.gender),
          s.exam_target,
          c?.seat_id ? (seat.get(c.seat_id)?.label ?? null) : null,
          c ? (shift.get(c.shift_id) ?? null) : null,
          c?.end_date ?? null,
          s.joined_on,
          label("studentStatus", s.status),
          label("source", s.source),
          s.address,
          s.notes,
        ];
      }),
    });
  }

  if (want("plans")) {
    sheets.push({
      key: "plans",
      title: t("sheet.plans"),
      columns: [
        { header: t("col.name"), type: "text", width: 24 },
        { header: t("col.mobile"), type: "text", width: 15 },
        { header: t("col.plan"), type: "text", width: 20 },
        { header: t("col.shift"), type: "text" },
        { header: t("col.time"), type: "text" },
        { header: t("col.seat"), type: "text" },
        { header: t("col.from"), type: "date" },
        { header: t("col.to"), type: "date" },
        { header: t("col.price"), type: "money" },
        { header: t("col.discount"), type: "money" },
        { header: t("col.discountReason"), type: "text", width: 20 },
        { header: t("col.status"), type: "text" },
      ],
      rows: subs.map((s): Value[] => {
        const r = range(s.shift_minutes);
        return [
          who(s.student_id),
          phone(s.student_id),
          s.plan_id ? (plan.get(s.plan_id) ?? null) : null,
          shift.get(s.shift_id) ?? null,
          r ? `${hhmm(r[0])}–${hhmm(r[1])}` : null,
          s.seat_id ? (seat.get(s.seat_id)?.label ?? null) : null,
          s.start_date,
          s.end_date,
          rupees(s.price_paise),
          rupees(s.discount_paise),
          s.discount_reason,
          label("planStatus", s.status),
        ];
      }),
    });
  }

  if (want("fees")) {
    sheets.push({
      key: "fees",
      title: t("sheet.fees"),
      columns: [
        { header: t("col.name"), type: "text", width: 24 },
        { header: t("col.mobile"), type: "text", width: 15 },
        { header: t("col.from"), type: "date" },
        { header: t("col.to"), type: "date" },
        { header: t("col.dueDate"), type: "date" },
        { header: t("col.amount"), type: "money" },
        { header: t("col.paid"), type: "money" },
        { header: t("col.owed"), type: "money" },
        { header: t("col.status"), type: "text" },
        { header: t("col.waivedReason"), type: "text", width: 20 },
      ],
      rows: invoices.map((i): Value[] => [
        who(i.student_id),
        phone(i.student_id),
        i.period_start,
        i.period_end,
        i.due_date,
        rupees(i.amount_due_paise),
        rupees(i.amount_paid_paise),
        i.status === "waived" ? 0 : rupees(i.amount_due_paise - i.amount_paid_paise),
        label("feeStatus", i.status),
        i.waived_reason,
      ]),
    });
  }

  if (want("payments")) {
    sheets.push({
      key: "payments",
      title: t("sheet.payments"),
      columns: [
        { header: t("col.receipt"), type: "text", width: 18 },
        { header: t("col.dateTime"), type: "datetime", width: 18 },
        { header: t("col.name"), type: "text", width: 24 },
        { header: t("col.mobile"), type: "text", width: 15 },
        { header: t("col.amount"), type: "money" },
        { header: t("col.method"), type: "text" },
        { header: t("col.upiNumber"), type: "text", width: 18 },
        { header: t("col.receivedBy"), type: "text", width: 16 },
        { header: t("col.cancelReason"), type: "text", width: 20 },
      ],
      rows: payments.map((p): Value[] => [
        p.receipt_number,
        localDateTime(p.received_at, timezone),
        who(p.student_id),
        phone(p.student_id),
        rupees(p.amount_paise),
        label("method", p.method),
        p.reference,
        p.received_by ? (member.get(p.received_by) ?? null) : null,
        p.reversal_reason,
      ]),
    });
  }

  if (want("attendance")) {
    sheets.push({
      key: "attendance",
      title: t("sheet.attendance"),
      columns: [
        { header: t("col.name"), type: "text", width: 24 },
        { header: t("col.mobile"), type: "text", width: 15 },
        { header: t("col.in"), type: "datetime", width: 18 },
        { header: t("col.out"), type: "datetime", width: 18 },
      ],
      rows: attendance.map((a): Value[] => [who(a.student_id), phone(a.student_id), localDateTime(a.check_in_at, timezone), localDateTime(a.check_out_at, timezone)]),
    });
  }

  if (want("seats")) {
    sheets.push({
      key: "seats",
      title: t("sheet.seats"),
      columns: [
        { header: t("col.seat"), type: "text" },
        { header: t("col.hall"), type: "text", width: 20 },
        { header: t("col.seatOpen"), type: "text" },
      ],
      rows: seats.map((s): Value[] => [s.label, s.zone_id ? (zone.get(s.zone_id) ?? null) : null, s.is_active ? t("yes") : t("no")]),
    });
  }

  return sheets;
}

"use server";

import { revalidatePath } from "next/cache";
import { todayInTz } from "@/lib/dates";
import { admitSchema, type AdmitInput } from "@/lib/schemas/admit";
import { phoneSchema } from "@/lib/schemas/auth";
import { requireLibrary } from "@/lib/session";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { createClient } from "@/lib/supabase/server";

function parseRange(r: unknown): [number, number] {
  const m = /^[[(](\d+),(\d+)[)\]]$/.exec(String(r));
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

export type AdmitData = {
  libraryId: string;
  libraryName: string;
  today: string;
  canDiscount: boolean;
  depositPaise: number;
  upiId: string | null;
  welcome: { hi: string; en: string };
  plans: { id: string; name: string; shiftId: string; months: number | null; days: number | null; pricePaise: number }[];
  shifts: { id: string; name: string; startMin: number; endMin: number; isFullDay: boolean }[];
  zones: { id: string; name: string; girlsOnly: boolean }[];
  seats: {
    id: string;
    label: string;
    zoneId: string | null;
    x: number;
    y: number;
    isActive: boolean;
    tags: string[];
    bookings: { startMin: number; endMin: number; startDate: string; endDate: string; studentId: string }[];
  }[];
};

/** Everything the admit sheet needs, fetched once when it opens. */
export async function getAdmitData(): Promise<AdmitData> {
  const { membership } = await requireLibrary();
  const lib = membership.libraryId;
  const today = todayInTz(membership.timezone);
  const supabase = await createClient();
  const [library, plans, shifts, zones, seats, subs] = await Promise.all([
    supabase.from("libraries").select("settings, upi_id, message_templates(key, locale, body)").eq("id", lib).eq("message_templates.key", "welcome").single(),
    supabase.from("plans").select("id, name, shift_id, duration_months, duration_days, price_paise").eq("library_id", lib).eq("is_active", true).order("sort_order"),
    supabase.from("shifts").select("id, name, start_min, end_min, is_full_day").eq("library_id", lib).eq("is_active", true).order("sort_order"),
    supabase.from("zones").select("id, name, attributes").eq("library_id", lib).order("sort_order"),
    supabase.from("seats").select("id, label, zone_id, x, y, is_active, tags").eq("library_id", lib),
    supabase
      .from("subscriptions")
      .select("seat_id, student_id, shift_minutes, start_date, end_date")
      .eq("library_id", lib)
      .in("status", ["upcoming", "active", "paused"])
      .gte("end_date", today)
      .not("seat_id", "is", null),
  ]);
  for (const r of [library, plans, shifts, zones, seats, subs]) if (r.error) throw r.error;

  const bookings = new Map<string, AdmitData["seats"][number]["bookings"]>();
  for (const s of subs.data!) {
    const [startMin, endMin] = parseRange(s.shift_minutes);
    const list = bookings.get(s.seat_id!) ?? [];
    list.push({ startMin, endMin, startDate: s.start_date, endDate: s.end_date, studentId: s.student_id });
    bookings.set(s.seat_id!, list);
  }
  const settings = (library.data!.settings ?? {}) as { deposit_paise?: number };
  const tpl = library.data!.message_templates ?? [];
  const welcome = {
    hi: tpl.find((t) => t.locale === "hi")?.body ?? DEFAULT_TEMPLATES.find((t) => t.key === "welcome" && t.locale === "hi")!.body,
    en: tpl.find((t) => t.locale === "en")?.body ?? DEFAULT_TEMPLATES.find((t) => t.key === "welcome" && t.locale === "en")!.body,
  };

  return {
    libraryId: lib,
    libraryName: membership.libraryName,
    today,
    canDiscount: membership.permissions.can_discount,
    depositPaise: settings.deposit_paise ?? 0,
    upiId: library.data!.upi_id,
    welcome,
    plans: plans.data!.map((p) => ({
      id: p.id,
      name: p.name,
      shiftId: p.shift_id,
      months: p.duration_months,
      days: p.duration_days,
      pricePaise: p.price_paise,
    })),
    shifts: shifts.data!.map((s) => ({ id: s.id, name: s.name, startMin: s.start_min, endMin: s.end_min, isFullDay: s.is_full_day })),
    zones: zones.data!.map((z) => ({ id: z.id, name: z.name, girlsOnly: Boolean((z.attributes as { girls_only?: boolean })?.girls_only) })),
    seats: seats.data!.map((s) => ({
      id: s.id,
      label: s.label,
      zoneId: s.zone_id,
      x: s.x,
      y: s.y,
      isActive: s.is_active,
      tags: s.tags,
      bookings: bookings.get(s.id) ?? [],
    })),
  };
}

export type ExistingStudent = {
  id: string;
  name: string;
  status: "active" | "paused" | "left";
  gender: "male" | "female" | "other" | null;
  examTarget: string | null;
  seatId: string | null;
  seatLabel: string | null;
  planId: string | null;
  endDate: string | null;
};

/** Step 1 of admit: is this number already a student here? */
export async function lookupStudent(rawPhone: string): Promise<{ ok: false } | { ok: true; phone: string; existing: ExistingStudent | null }> {
  const parsed = phoneSchema.safeParse(rawPhone);
  if (!parsed.success) return { ok: false };
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("students")
    .select("id, name, status, gender, exam_target")
    .eq("library_id", membership.libraryId)
    .eq("phone", parsed.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (!s) return { ok: true, phone: parsed.data, existing: null };
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan_id, seat_id, end_date, seat:seats(label)")
    .eq("student_id", s.id)
    .neq("status", "cancelled")
    .order("end_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    ok: true,
    phone: parsed.data,
    existing: {
      id: s.id,
      name: s.name,
      status: s.status,
      gender: s.gender,
      examTarget: s.exam_target,
      seatId: sub?.seat_id ?? null,
      seatLabel: sub?.seat?.label ?? null,
      planId: sub?.plan_id ?? null,
      endDate: sub?.end_date ?? null,
    },
  };
}

export type AdmitError = "seatTaken" | "phoneExists" | "noDiscount" | "overpayment" | "invalid" | "failed";
export type AdmitResult =
  | {
      ok: true;
      studentId: string;
      startDate: string;
      endDate: string;
      amountDuePaise: number;
      receiptNumber: string | null;
      receiptToken: string | null;
    }
  | { ok: false; error: AdmitError; existingId?: string };

export async function admitStudent(input: AdmitInput): Promise<AdmitResult> {
  const parsed = admitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { membership } = await requireLibrary();
  const supabase = await createClient();

  const payment = v.payment ? { amount_paise: v.payment.amountPaise, method: v.payment.method, reference: v.payment.reference } : null;
  const common = {
    library_id: membership.libraryId,
    client_op_id: v.clientOpId,
    plan_id: v.planId,
    seat_id: v.seatId,
    start_date: v.startDate,
    discount_paise: v.discountPaise,
    discount_reason: v.discountReason,
    payment,
  };

  const { data, error } =
    v.mode === "renew"
      ? await supabase.rpc("renew_subscription", { input: { ...common, student_id: v.studentId } })
      : await supabase.rpc("admit_student", {
          input: {
            ...common,
            student: {
              name: v.name,
              phone: v.phone,
              gender: v.gender,
              exam_target: v.examTarget,
              photo_path: v.photoPath,
              id_proof_path: v.idProofPath,
              source: "walk_in",
            },
            deposit: v.depositPaise > 0 ? { amount_paise: v.depositPaise, method: v.depositMethod } : null,
          },
        });

  if (error) {
    if (error.code === "23P01") return { ok: false, error: "seatTaken" };
    if (error.message.includes("PHONE_EXISTS")) return { ok: false, error: "phoneExists", existingId: error.details ?? undefined };
    if (error.message.includes("NO_DISCOUNT_PERMISSION")) return { ok: false, error: "noDiscount" };
    if (error.message.includes("OVERPAYMENT")) return { ok: false, error: "overpayment" };
    console.error("admit failed", error);
    return { ok: false, error: "failed" };
  }

  let r = data as Record<string, string | number | boolean | null>;
  if (r.duplicate) {
    // Same admit sent twice (weak internet): report what was saved the first time.
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("start_date, end_date, price_paise, discount_paise")
      .eq("id", String(r.subscription_id))
      .single();
    r = { ...r, start_date: sub?.start_date ?? null, end_date: sub?.end_date ?? null, amount_due_paise: sub ? sub.price_paise - sub.discount_paise : 0 };
  }
  for (const p of ["/today", "/seats", "/students", "/fees"]) revalidatePath(p);
  revalidatePath(`/students/${r.student_id}`);
  return {
    ok: true,
    studentId: String(r.student_id),
    startDate: String(r.start_date ?? v.startDate),
    endDate: String(r.end_date ?? v.startDate),
    amountDuePaise: Number(r.amount_due_paise ?? 0),
    receiptNumber: (r.receipt_number as string) ?? null,
    receiptToken: (r.receipt_token as string) ?? null,
  };
}

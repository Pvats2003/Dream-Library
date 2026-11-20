import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StudentProfile = {
  id: string;
  name: string;
  phone: string;
  altPhone: string | null;
  guardianPhone: string | null;
  gender: "male" | "female" | "other" | null;
  examTarget: string | null;
  address: string | null;
  notes: string | null;
  source: string | null;
  joinedOn: string;
  status: "active" | "paused" | "left";
  photoUrl: string | null;
  idProofUrl: string | null;
  plans: {
    id: string;
    planName: string;
    shiftName: string;
    startMin: number;
    endMin: number;
    seatLabel: string | null;
    startDate: string;
    endDate: string;
    status: "upcoming" | "active" | "paused" | "expired" | "cancelled";
    pricePaise: number;
    discountPaise: number;
    discountReason: string | null;
  }[];
  pauseUntil: string | null;
  invoices: {
    id: string;
    dueDate: string;
    periodStart: string | null;
    periodEnd: string | null;
    amountDuePaise: number;
    amountPaidPaise: number;
    status: "due" | "partial" | "paid" | "waived";
    payments: { id: string; amountPaise: number; method: string; receivedAt: string; receiptNumber: string | null; receiptToken: string }[];
  }[];
  deposits: { amountPaise: number; status: "held" | "refunded" | "adjusted"; receivedAt: string }[];
  attendance: { checkInAt: string; checkOutAt: string | null }[];
  activity: { id: number; action: string; entity: string; createdAt: string; before: unknown; after: unknown }[] | null;
};

function parseRange(r: unknown): [number, number] {
  const m = /^[[(](\d+),(\d+)[)\]]$/.exec(String(r));
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

export async function getStudentProfile(libraryId: string, id: string, canSeeHistory: boolean): Promise<StudentProfile | null> {
  const supabase = await createClient();
  const { data: s, error } = await supabase
    .from("students")
    .select("*")
    .eq("library_id", libraryId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!s) return null;

  const [subs, invoices, deposits, attendance, activity, signed] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, start_date, end_date, status, price_paise, discount_paise, discount_reason, shift_minutes, subscription_pauses(to_date), plan:plans(name), shift:shifts(name), seat:seats(label)")
      .eq("student_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, due_date, period_start, period_end, amount_due_paise, amount_paid_paise, status, payments(id, amount_paise, method, received_at, receipt_number, receipt_token)")
      .eq("student_id", id)
      .order("due_date", { ascending: false }),
    supabase.from("deposits").select("amount_paise, status, received_at").eq("student_id", id).order("received_at", { ascending: false }),
    supabase.from("attendance").select("check_in_at, check_out_at").eq("student_id", id).order("check_in_at", { ascending: false }).limit(60),
    canSeeHistory
      ? supabase
          .from("activity_log")
          .select("id, action, entity, created_at, before, after")
          .eq("library_id", libraryId)
          .or(`entity_id.eq.${id},after->>student_id.eq.${id},before->>student_id.eq.${id}`)
          .order("created_at", { ascending: false })
          .limit(40)
      : Promise.resolve({ data: null, error: null }),
    [s.photo_path, s.id_proof_path].some(Boolean)
      ? supabase.storage
          .from("student-files")
          .createSignedUrls([s.photo_path, s.id_proof_path].filter((p): p is string => Boolean(p)), 3600)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [subs, invoices, deposits, attendance, activity]) if (r.error) throw r.error;

  const urlFor = (path: string | null) => (path ? (signed.data?.find((x) => x.path === path)?.signedUrl ?? null) : null);
  const paused = subs.data!.find((p) => p.status === "paused");
  const pauseUntil = paused
    ? ((paused.subscription_pauses ?? []).map((p) => p.to_date).sort().at(-1) ?? null)
    : null;

  return {
    id: s.id,
    name: s.name,
    phone: s.phone,
    altPhone: s.alt_phone,
    guardianPhone: s.guardian_phone,
    gender: s.gender,
    examTarget: s.exam_target,
    address: s.address,
    notes: s.notes,
    source: s.source,
    joinedOn: s.joined_on,
    status: s.status,
    photoUrl: urlFor(s.photo_path),
    idProofUrl: urlFor(s.id_proof_path),
    plans: subs.data!.map((p) => {
      const [startMin, endMin] = parseRange(p.shift_minutes);
      return {
        id: p.id,
        planName: p.plan?.name ?? "",
        shiftName: p.shift?.name ?? "",
        startMin,
        endMin,
        seatLabel: p.seat?.label ?? null,
        startDate: p.start_date,
        endDate: p.end_date,
        status: p.status,
        pricePaise: p.price_paise,
        discountPaise: p.discount_paise,
        discountReason: p.discount_reason,
      };
    }),
    pauseUntil,
    invoices: invoices.data!.map((i) => ({
      id: i.id,
      dueDate: i.due_date,
      periodStart: i.period_start,
      periodEnd: i.period_end,
      amountDuePaise: i.amount_due_paise,
      amountPaidPaise: i.amount_paid_paise,
      status: i.status,
      payments: (i.payments ?? [])
        .map((p) => ({
          id: p.id,
          amountPaise: p.amount_paise,
          method: p.method,
          receivedAt: p.received_at,
          receiptNumber: p.receipt_number,
          receiptToken: p.receipt_token,
        }))
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    })),
    deposits: deposits.data!.map((d) => ({ amountPaise: d.amount_paise, status: d.status, receivedAt: d.received_at })),
    attendance: attendance.data!.map((a) => ({ checkInAt: a.check_in_at, checkOutAt: a.check_out_at })),
    activity: activity.data
      ? activity.data.map((a) => ({ id: a.id, action: a.action, entity: a.entity, createdAt: a.created_at, before: a.before, after: a.after }))
      : null,
  };
}

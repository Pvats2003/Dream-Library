"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeIndianMobile } from "@/lib/phone";
import { requireLibrary } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type ImportResult =
  | { ok: true; studentId: string }
  | { ok: false; error: "phoneExists" | "seatTaken" | "alreadyDone" | "invalid" | "failed" };

const schema = z.object({
  requestId: z.uuid().nullable(),
  name: z.string().trim().min(1).max(120),
  phone: z.string(),
  gender: z.enum(["male", "female", "other"]).nullable(),
  examTarget: z.string().trim().max(60).nullable(),
  planId: z.uuid(),
  seatId: z.uuid().nullable(),
  startDate: z.iso.date(),
  pendingPaise: z.number().int().min(0),
});
export type ImportInput = z.input<typeof schema>;

function refresh() {
  for (const p of ["/today", "/seats", "/students", "/fees", "/students/requests"]) revalidatePath(p);
}

async function importOne(v: z.output<typeof schema>, libraryId: string): Promise<ImportResult> {
  const phone = normalizeIndianMobile(v.phone);
  if (!phone) return { ok: false, error: "invalid" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_student", {
    input: {
      library_id: libraryId,
      request_id: v.requestId,
      name: v.name,
      phone,
      gender: v.gender,
      exam_target: v.examTarget,
      plan_id: v.planId,
      seat_id: v.seatId,
      start_date: v.startDate,
      pending_paise: v.pendingPaise,
    },
  });
  if (error) {
    if (error.message.includes("PHONE_EXISTS")) return { ok: false, error: "phoneExists" };
    if (error.code === "23P01") return { ok: false, error: "seatTaken" };
    if (error.message.includes("REQUEST_DONE")) return { ok: false, error: "alreadyDone" };
    console.error("import_student", error);
    return { ok: false, error: "failed" };
  }
  return { ok: true, studentId: String((data as { student_id: string }).student_id) };
}

/** Add an existing student, from a request or typed by staff. */
export async function importStudent(input: ImportInput): Promise<ImportResult> {
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: "invalid" };
  const { membership } = await requireLibrary();
  const res = await importOne(v.data, membership.libraryId);
  if (res.ok) refresh();
  return res;
}

/** "Confirm all that look right": each one separately, so one failure doesn't stop the rest. */
export async function importMany(inputs: ImportInput[]): Promise<{ added: number; failed: string[] }> {
  const { membership } = await requireLibrary();
  let added = 0;
  const failed: string[] = [];
  for (const input of inputs.slice(0, 200)) {
    const v = schema.safeParse(input);
    if (!v.success) {
      failed.push(String(input.requestId));
      continue;
    }
    const res = await importOne(v.data, membership.libraryId);
    if (res.ok) added += 1;
    else failed.push(String(input.requestId));
  }
  refresh();
  return { added, failed };
}

export async function rejectRequest(id: string): Promise<{ ok: boolean }> {
  const v = z.uuid().safeParse(id);
  if (!v.success) return { ok: false };
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase
    .from("join_requests")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", v.data)
    .eq("library_id", membership.libraryId)
    .eq("status", "pending");
  if (error) return { ok: false };
  refresh();
  return { ok: true };
}

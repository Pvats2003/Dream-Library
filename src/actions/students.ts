"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLibrary } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { normalizeIndianMobile } from "@/lib/phone";

export type Result = { ok: true } | { ok: false; error: "invalid" | "noPermission" | "phoneExists" | "failed" };

function refresh(id: string) {
  for (const p of ["/today", "/seats", "/students", "/fees"]) revalidatePath(p);
  revalidatePath(`/students/${id}`);
}

const optionalPhone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizeIndianMobile(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "invalidPhone" });
      return z.NEVER;
    }
    return n;
  });

const updateSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "invalidPhone" });
      return z.NEVER;
    }
    return n;
  }),
  altPhone: optionalPhone,
  guardianPhone: optionalPhone,
  gender: z.enum(["male", "female", "other"]).nullable(),
  examTarget: z.string().trim().max(60).transform((v) => v || null),
  address: z.string().trim().max(300).transform((v) => v || null),
  notes: z.string().trim().max(2000).transform((v) => v || null),
});
export type UpdateStudentInput = z.input<typeof updateSchema>;

export async function updateStudent(input: UpdateStudentInput): Promise<Result> {
  const v = updateSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "invalid" };
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({
      name: v.data.name,
      phone: v.data.phone,
      alt_phone: v.data.altPhone,
      guardian_phone: v.data.guardianPhone,
      gender: v.data.gender,
      exam_target: v.data.examTarget,
      address: v.data.address,
      notes: v.data.notes,
    })
    .eq("id", v.data.id)
    .eq("library_id", membership.libraryId);
  if (error) return { ok: false, error: error.code === "23505" ? "phoneExists" : "failed" };
  refresh(v.data.id);
  return { ok: true };
}

export async function saveNotes(id: string, notes: string): Promise<Result> {
  const v = z.object({ id: z.uuid(), notes: z.string().max(2000) }).safeParse({ id, notes });
  if (!v.success) return { ok: false, error: "invalid" };
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase
    .from("students")
    .update({ notes: v.data.notes.trim() || null })
    .eq("id", v.data.id)
    .eq("library_id", membership.libraryId);
  if (error) return { ok: false, error: "failed" };
  revalidatePath(`/students/${v.data.id}`);
  return { ok: true };
}

export async function pausePlan(studentId: string, subscriptionId: string, days: number, reason: string): Promise<Result> {
  const v = z
    .object({ studentId: z.uuid(), sub: z.uuid(), days: z.number().int().min(1).max(120), reason: z.string().max(200) })
    .safeParse({ studentId, sub: subscriptionId, days, reason });
  if (!v.success) return { ok: false, error: "invalid" };
  await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase.rpc("pause_subscription", { sub: v.data.sub, days: v.data.days, reason: v.data.reason });
  if (error) return { ok: false, error: "failed" };
  refresh(v.data.studentId);
  return { ok: true };
}

export async function resumePlan(studentId: string, subscriptionId: string): Promise<Result> {
  const v = z.object({ studentId: z.uuid(), sub: z.uuid() }).safeParse({ studentId, sub: subscriptionId });
  if (!v.success) return { ok: false, error: "invalid" };
  await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase.rpc("resume_subscription", { sub: v.data.sub });
  if (error) return { ok: false, error: "failed" };
  refresh(v.data.studentId);
  return { ok: true };
}

export async function markLeft(studentId: string, deposit: "refunded" | "adjusted" | "keep", note: string): Promise<Result> {
  const v = z
    .object({ id: z.uuid(), deposit: z.enum(["refunded", "adjusted", "keep"]), note: z.string().max(300) })
    .safeParse({ id: studentId, deposit, note });
  if (!v.success) return { ok: false, error: "invalid" };
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_delete) return { ok: false, error: "noPermission" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_left", { stu: v.data.id, deposit_action: v.data.deposit, note: v.data.note });
  if (error) return { ok: false, error: error.code === "42501" ? "noPermission" : "failed" };
  refresh(v.data.id);
  return { ok: true };
}

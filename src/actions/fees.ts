"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLibrary } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

function refresh(studentId?: string) {
  for (const p of ["/today", "/fees", "/students", "/seats"]) revalidatePath(p);
  if (studentId) revalidatePath(`/students/${studentId}`);
}

export type PaymentResult =
  | { ok: true; receiptNumber: string; receiptToken: string; stillOwedPaise: number }
  | { ok: false; error: "overpayment" | "alreadyPaid" | "badAmount" | "failed" };

const paySchema = z.object({
  invoiceId: z.uuid(),
  studentId: z.uuid(),
  amountPaise: z.number().int().positive().max(10_000_000),
  method: z.enum(["cash", "upi", "card", "bank"]),
  reference: z.string().trim().max(60),
  clientOpId: z.uuid(),
});

/** Record money received against a fee and get the receipt back. */
export async function recordPayment(input: z.input<typeof paySchema>): Promise<PaymentResult> {
  const v = paySchema.safeParse(input);
  if (!v.success) return { ok: false, error: "badAmount" };
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_payment", {
    input: {
      library_id: membership.libraryId,
      invoice_id: v.data.invoiceId,
      amount_paise: v.data.amountPaise,
      method: v.data.method,
      reference: v.data.reference,
      client_op_id: v.data.clientOpId,
    },
  });
  if (error) {
    if (error.message.includes("OVERPAYMENT")) return { ok: false, error: "overpayment" };
    if (error.message.includes("ALREADY_PAID")) return { ok: false, error: "alreadyPaid" };
    if (error.message.includes("BAD_AMOUNT")) return { ok: false, error: "badAmount" };
    console.error("record_payment", error);
    return { ok: false, error: "failed" };
  }
  const r = data as { receipt_number: string; receipt_token: string; still_owed_paise?: number };
  refresh(v.data.studentId);
  return { ok: true, receiptNumber: r.receipt_number, receiptToken: r.receipt_token, stillOwedPaise: r.still_owed_paise ?? 0 };
}

/** Log that a WhatsApp reminder was opened (who, when, what text). */
export async function logReminder(input: { studentId: string; invoiceId: string | null; templateKey: string; body: string }) {
  const v = z
    .object({ studentId: z.uuid(), invoiceId: z.uuid().nullable(), templateKey: z.string().max(20), body: z.string().max(2000) })
    .safeParse(input);
  if (!v.success) return;
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  await supabase.from("reminders").insert({
    library_id: membership.libraryId,
    student_id: v.data.studentId,
    invoice_id: v.data.invoiceId,
    template_key: v.data.templateKey,
    body: v.data.body,
  });
}

export async function snoozeInvoice(invoiceId: string, days: number): Promise<{ ok: boolean }> {
  const v = z.object({ id: z.uuid(), days: z.number().int().min(1).max(30) }).safeParse({ id: invoiceId, days });
  if (!v.success) return { ok: false };
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const until = new Date(Date.now() + v.data.days * 86_400_000).toISOString().slice(0, 10);
  const { error } = await supabase.from("invoices").update({ snoozed_until: until }).eq("id", v.data.id).eq("library_id", membership.libraryId);
  if (error) return { ok: false };
  refresh();
  return { ok: true };
}

export async function unsnoozeInvoice(invoiceId: string): Promise<{ ok: boolean }> {
  const v = z.uuid().safeParse(invoiceId);
  if (!v.success) return { ok: false };
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ snoozed_until: null }).eq("id", v.data).eq("library_id", membership.libraryId);
  if (error) return { ok: false };
  refresh();
  return { ok: true };
}

export type RenewResult =
  | { ok: true; invoiceId: string; amountDuePaise: number; startDate: string; endDate: string; seatLost: boolean }
  | { ok: false; error: "failed" };

/** Same plan, same seat (if still free), next period. Returns the new fee to collect. */
export async function quickRenew(studentId: string, clientOpId: string): Promise<RenewResult> {
  const v = z.object({ s: z.uuid(), op: z.uuid() }).safeParse({ s: studentId, op: clientOpId });
  if (!v.success) return { ok: false, error: "failed" };
  await requireLibrary();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quick_renew", { stu: v.data.s, op: v.data.op });
  if (error) {
    console.error("quick_renew", error);
    return { ok: false, error: "failed" };
  }
  const r = data as { invoice_id: string; amount_due_paise: number; start_date: string; end_date: string; seat_lost?: boolean };
  refresh(v.data.s);
  return { ok: true, invoiceId: r.invoice_id, amountDuePaise: r.amount_due_paise, startDate: r.start_date, endDate: r.end_date, seatLost: Boolean(r.seat_lost) };
}

const KEYS = ["welcome", "reminder", "expiring", "receipt", "overdue"] as const;

/** Owner edits a WhatsApp message text. */
export async function saveTemplate(key: string, locale: string, body: string): Promise<{ ok: boolean }> {
  const v = z.object({ key: z.enum(KEYS), locale: z.enum(["hi", "en"]), body: z.string().trim().min(1).max(2000) }).safeParse({ key, locale, body });
  if (!v.success) return { ok: false };
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_edit_settings) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .upsert({ library_id: membership.libraryId, key: v.data.key, locale: v.data.locale, body: v.data.body }, { onConflict: "library_id,key,locale" });
  if (error) return { ok: false };
  revalidatePath("/more/templates");
  revalidatePath("/fees");
  return { ok: true };
}

export async function reversePayment(paymentId: string, studentId: string, reason: string): Promise<{ ok: true } | { ok: false; error: "noPermission" | "reason" | "failed" }> {
  const v = z.object({ p: z.uuid(), s: z.uuid(), reason: z.string().trim().min(1).max(200) }).safeParse({ p: paymentId, s: studentId, reason });
  if (!v.success) return { ok: false, error: "reason" };
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_delete) return { ok: false, error: "noPermission" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_payment", { payment: v.data.p, reason: v.data.reason });
  if (error) return { ok: false, error: error.code === "42501" ? "noPermission" : "failed" };
  refresh(v.data.s);
  return { ok: true };
}

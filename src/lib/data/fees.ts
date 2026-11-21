import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/templates";

export type OpenInvoice = {
  id: string;
  studentId: string;
  studentName: string;
  phone: string;
  seatLabel: string | null;
  planName: string | null;
  dueDate: string;
  periodEnd: string | null;
  amountDue: number;
  amountPaid: number;
  owed: number;
  payToken: string;
};

export type EndingPlan = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  phone: string;
  seatLabel: string | null;
  planName: string;
  endDate: string;
  pricePaise: number;
};

/** Unpaid and part-paid fees due up to a week from today (snoozed ones hidden). */
export async function getOpenInvoices(libraryId: string, today: string): Promise<{ invoices: OpenInvoice[]; snoozed: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, due_date, period_end, amount_due_paise, amount_paid_paise, snoozed_until, pay_token, student:students!inner(id, name, phone, status, deleted_at), subscription:subscriptions(seat:seats(label), plan:plans(name))",
    )
    .eq("library_id", libraryId)
    .in("status", ["due", "partial"])
    .lte("due_date", addDays(today, 6))
    .neq("student.status", "left")
    .is("student.deleted_at", null)
    .order("due_date");
  if (error) throw error;
  const visible = data.filter((i) => !i.snoozed_until || i.snoozed_until <= today);
  return {
    snoozed: data.length - visible.length,
    invoices: visible.map((i) => ({
      id: i.id,
      studentId: i.student.id,
      studentName: i.student.name,
      phone: i.student.phone,
      seatLabel: i.subscription?.seat?.label ?? null,
      planName: i.subscription?.plan?.name ?? null,
      dueDate: i.due_date,
      periodEnd: i.period_end,
      amountDue: i.amount_due_paise,
      amountPaid: i.amount_paid_paise,
      owed: i.amount_due_paise - i.amount_paid_paise,
      payToken: i.pay_token,
    })),
  };
}

/** Plans ending within a week that have no next period yet (one-tap renew). */
export async function getEndingSoon(libraryId: string, today: string): Promise<EndingPlan[]> {
  const supabase = await createClient();
  const [ending, later] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("id, end_date, price_paise, discount_paise, student:students!inner(id, name, phone, status, deleted_at), seat:seats(label), plan:plans(name)")
      .eq("library_id", libraryId)
      .eq("status", "active")
      .gte("end_date", today)
      .lte("end_date", addDays(today, 7))
      .eq("student.status", "active")
      .is("student.deleted_at", null)
      .order("end_date"),
    supabase.from("subscriptions").select("student_id, start_date").eq("library_id", libraryId).in("status", ["upcoming", "active"]).gt("start_date", today),
  ]);
  if (ending.error) throw ending.error;
  if (later.error) throw later.error;
  const hasNext = new Set(later.data.map((s) => s.student_id));
  return ending.data
    .filter((s) => !hasNext.has(s.student.id))
    .map((s) => ({
      subscriptionId: s.id,
      studentId: s.student.id,
      studentName: s.student.name,
      phone: s.student.phone,
      seatLabel: s.seat?.label ?? null,
      planName: s.plan?.name ?? "",
      endDate: s.end_date,
      pricePaise: s.price_paise - s.discount_paise,
    }));
}

export type Templates = Record<TemplateKey, string>;

/** The library's own WhatsApp texts (falling back to the starting texts). */
export async function getTemplates(libraryId: string, locale: "hi" | "en"): Promise<Templates> {
  const supabase = await createClient();
  const { data } = await supabase.from("message_templates").select("key, body").eq("library_id", libraryId).eq("locale", locale);
  const out = {} as Templates;
  for (const t of DEFAULT_TEMPLATES.filter((x) => x.locale === locale)) out[t.key] = t.body;
  for (const t of data ?? []) out[t.key as TemplateKey] = t.body;
  return out;
}

export async function getLibraryPayInfo(libraryId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("libraries").select("name, upi_id").eq("id", libraryId).single();
  return { name: data?.name ?? "", upiId: data?.upi_id ?? null };
}

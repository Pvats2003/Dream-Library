import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";

export type OpenInvoice = {
  id: string;
  studentId: string;
  studentName: string;
  phone: string;
  seatLabel: string | null;
  dueDate: string;
  amountDue: number;
  amountPaid: number;
  owed: number;
};

/** Unpaid and part-paid fees due up to a week from today. */
export async function getOpenInvoices(libraryId: string, today: string): Promise<OpenInvoice[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, due_date, amount_due_paise, amount_paid_paise, snoozed_until, student:students!inner(id, name, phone, status, deleted_at), subscription:subscriptions(seat:seats(label))",
    )
    .eq("library_id", libraryId)
    .in("status", ["due", "partial"])
    .lte("due_date", addDays(today, 6))
    .neq("student.status", "left")
    .is("student.deleted_at", null)
    .order("due_date");
  if (error) throw error;
  return data
    .filter((i) => !i.snoozed_until || i.snoozed_until <= today)
    .map((i) => ({
      id: i.id,
      studentId: i.student.id,
      studentName: i.student.name,
      phone: i.student.phone,
      seatLabel: i.subscription?.seat?.label ?? null,
      dueDate: i.due_date,
      amountDue: i.amount_due_paise,
      amountPaid: i.amount_paid_paise,
      owed: i.amount_due_paise - i.amount_paid_paise,
    }));
}

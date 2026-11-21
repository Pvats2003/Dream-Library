import type { Metadata } from "next";
import { getAdmitData } from "@/actions/admit";
import { RequestsInbox } from "@/components/features/join/requests-inbox";
import type { JoinRequest } from "@/lib/requests";
import { requireLibrary } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Requests" };

export default async function RequestsPage() {
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const [{ data: rows, error }, admit] = await Promise.all([
    supabase
      .from("join_requests")
      .select("id, name, phone, gender, shift_id, seat_label, last_paid_on, exam_target, created_at")
      .eq("library_id", membership.libraryId)
      .eq("status", "pending")
      .order("created_at")
      .limit(300),
    getAdmitData(),
  ]);
  if (error) throw error;
  const requests: JoinRequest[] = (rows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone,
    gender: r.gender,
    shiftId: r.shift_id,
    seatLabel: r.seat_label,
    lastPaidOn: r.last_paid_on,
    examTarget: r.exam_target,
    createdAt: r.created_at,
  }));
  const phones = [...new Set(requests.map((r) => r.phone))];
  const { data: existing } = phones.length
    ? await supabase.from("students").select("phone").eq("library_id", membership.libraryId).is("deleted_at", null).in("phone", phones)
    : { data: [] as { phone: string }[] };
  return <RequestsInbox requests={requests} data={admit} existingPhones={(existing ?? []).map((s) => s.phone)} />;
}

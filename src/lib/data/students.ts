import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StudentListItem = {
  id: string;
  name: string;
  phone: string;
  status: "active" | "paused" | "left";
  examTarget: string | null;
  seatLabel: string | null;
  shiftName: string | null;
  endDate: string | null;
  owes: boolean;
  photoUrl: string | null;
};

export async function getStudentList(libraryId: string, today: string): Promise<StudentListItem[]> {
  const supabase = await createClient();
  const [students, subs, dues] = await Promise.all([
    supabase
      .from("students")
      .select("id, name, phone, status, exam_target, photo_path")
      .eq("library_id", libraryId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("subscriptions")
      .select("student_id, end_date, status, seat:seats(label), shift:shifts(name)")
      .eq("library_id", libraryId)
      .in("status", ["active", "paused", "upcoming", "expired"])
      .order("end_date", { ascending: false }),
    supabase
      .from("invoices")
      .select("student_id")
      .eq("library_id", libraryId)
      .in("status", ["due", "partial"])
      .lte("due_date", today),
  ]);
  for (const r of [students, subs, dues]) if (r.error) throw r.error;

  // Latest plan per student (list is ordered by end date, newest first).
  const latest = new Map<string, NonNullable<typeof subs.data>[number]>();
  for (const s of subs.data!) if (!latest.has(s.student_id)) latest.set(s.student_id, s);
  const owing = new Set(dues.data!.map((d) => d.student_id));
  const paths = students.data!.map((s) => s.photo_path).filter((p): p is string => Boolean(p));
  const signed = paths.length ? (await supabase.storage.from("student-files").createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlFor = (p: string | null) => (p ? (signed.find((x) => x.path === p)?.signedUrl ?? null) : null);

  return students.data!.map((s) => {
    const sub = latest.get(s.id);
    return {
      id: s.id,
      name: s.name,
      phone: s.phone,
      status: s.status,
      examTarget: s.exam_target,
      seatLabel: sub?.seat?.label ?? null,
      shiftName: sub?.shift?.name ?? null,
      endDate: sub?.end_date ?? null,
      owes: owing.has(s.id),
      photoUrl: urlFor(s.photo_path),
    };
  });
}

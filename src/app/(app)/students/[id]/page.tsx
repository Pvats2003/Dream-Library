import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StudentProfileView } from "@/components/features/students/student-profile";
import { todayInTz } from "@/lib/dates";
import { getStudentProfile } from "@/lib/data/student";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { membership } = await requireLibrary();
  const profile = await getStudentProfile(membership.libraryId, id, membership.permissions.can_delete);
  if (!profile) notFound();
  return (
    <StudentProfileView
      s={profile}
      today={todayInTz(membership.timezone)}
      timezone={membership.timezone}
      canMarkLeft={membership.permissions.can_delete}
    />
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { StudentProfileView } from "@/components/features/students/student-profile";
import { todayInTz } from "@/lib/dates";
import { getLibraryPayInfo, getTemplates } from "@/lib/data/fees";
import { getStudentProfile } from "@/lib/data/student";
import { getLocale } from "next-intl/server";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Student" };

export default async function StudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { membership } = await requireLibrary();
  const locale = (await getLocale()) as "hi" | "en";
  const [profile, lib, templates] = await Promise.all([
    getStudentProfile(
      membership.libraryId,
      id,
      membership.permissions.can_delete,
    ),
    getLibraryPayInfo(membership.libraryId),
    getTemplates(membership.libraryId, locale),
  ]);
  if (!profile) notFound();
  return (
    <StudentProfileView
      s={profile}
      today={todayInTz(membership.timezone)}
      timezone={membership.timezone}
      canMarkLeft={membership.permissions.can_delete}
      canReverse={membership.permissions.can_delete}
      pay={{
        upiId: lib.upiId,
        libraryName: lib.name,
        receiptTemplate: templates.receipt,
      }}
    />
  );
}

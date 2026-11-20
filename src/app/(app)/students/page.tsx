import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StudentList } from "@/components/features/students/student-list";
import { PageHeader } from "@/components/patterns/page-header";
import { libraryToday } from "@/lib/data/library";
import { getStudentList } from "@/lib/data/students";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage() {
  const { membership } = await requireLibrary();
  const today = await libraryToday(membership.libraryId);
  const [students, t] = await Promise.all([getStudentList(membership.libraryId, today), getTranslations("students")]);
  const current = students.filter((s) => s.status !== "left").length;
  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("count", { count: current })} />
      <StudentList students={students} today={today} />
    </div>
  );
}

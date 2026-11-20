import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdmitAutoOpen } from "@/components/features/admit/admit-provider";
import { StudentList } from "@/components/features/students/student-list";
import { PageHeader } from "@/components/patterns/page-header";
import { todayInTz } from "@/lib/dates";
import { getStudentList } from "@/lib/data/students";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Students" };

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const { membership } = await requireLibrary();
  const today = todayInTz(membership.timezone);
  const [students, t] = await Promise.all([getStudentList(membership.libraryId, today), getTranslations("students")]);
  const current = students.filter((s) => s.status !== "left").length;
  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("count", { count: current })} />
      <AdmitAutoOpen when={add === "1"} />
      <StudentList students={students} today={today} />
    </div>
  );
}

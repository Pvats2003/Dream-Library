import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StudentList } from "@/components/features/students/student-list";
import { StudentsPane } from "@/components/features/students/students-pane";
import { RequestsBanner } from "@/components/patterns/requests-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { todayInTz } from "@/lib/dates";
import { countPendingRequests } from "@/lib/data/requests";
import { getStudentList } from "@/lib/data/students";
import { requireLibrary } from "@/lib/session";

/**
 * Desktop: the student list stays on the left and the chosen profile opens
 * on the right, so the owner can go down the list without going back and
 * forth. Phones see one screen at a time, as before. The list streams in
 * behind a skeleton so switching tabs never waits on it.
 */
export default async function StudentsLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("students");
  return (
    <div className="lg:grid lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)] lg:gap-8">
      <StudentsPane title={t("title")}>
        <Suspense fallback={<ListSkeleton />}>
          <PaneBody />
        </Suspense>
      </StudentsPane>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

async function PaneBody() {
  const { membership } = await requireLibrary();
  const today = todayInTz(membership.timezone);
  const [students, t, pending] = await Promise.all([
    getStudentList(membership.libraryId, today),
    getTranslations("students"),
    countPendingRequests(membership.libraryId),
  ]);
  const current = students.filter((s) => s.status !== "left").length;
  return (
    <>
      <p className="mt-1 mb-4 text-base text-text-2">{t("count", { count: current })}</p>
      <RequestsBanner count={pending} />
      <StudentList students={students} today={today} />
    </>
  );
}

function ListSkeleton() {
  return (
    <div aria-busy>
      <Skeleton className="mt-2 mb-4 h-5 w-24" />
      <Skeleton className="h-12 rounded-[12px]" />
      <Skeleton className="mt-3 h-[52px] rounded-[14px]" />
      <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-surface">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-1.5 h-4 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

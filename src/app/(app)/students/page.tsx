import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdmitAutoOpen } from "@/components/features/admit/admit-provider";
import { EmptyState } from "@/components/patterns/empty-state";

export const metadata: Metadata = { title: "Students" };

/** The list itself lives in the layout. Desktop shows a hint on the right until someone is picked. */
export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const { add } = await searchParams;
  const t = await getTranslations("students");
  return (
    <>
      <AdmitAutoOpen when={add === "1"} />
      <div className="hidden pt-10 lg:block">
        <div className="grid min-h-[60dvh] place-items-center rounded-[20px] border border-dashed border-border-strong">
          <EmptyState art="books" title={t("pickOne")} body={t("pickOneBody")} />
        </div>
      </div>
    </>
  );
}

import { CircleCheck, Phone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/patterns/empty-state";
import { Money } from "@/components/patterns/money";
import { PageHeader } from "@/components/patterns/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { daysBetween, formatDay, type AppLocale } from "@/lib/dates";
import { getOpenInvoices, type OpenInvoice } from "@/lib/data/fees";
import { libraryToday } from "@/lib/data/library";
import { formatINR } from "@/lib/money";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage() {
  const { membership } = await requireLibrary();
  const today = await libraryToday(membership.libraryId);
  const [invoices, t, locale] = await Promise.all([
    getOpenInvoices(membership.libraryId, today),
    getTranslations("fees"),
    getLocale() as Promise<AppLocale>,
  ]);

  const groups = [
    { key: "overdue", title: t("overdue"), items: invoices.filter((i) => i.dueDate < today), tone: "text-danger" },
    { key: "today", title: t("dueToday"), items: invoices.filter((i) => i.dueDate === today), tone: "text-warning" },
    { key: "week", title: t("thisWeek"), items: invoices.filter((i) => i.dueDate > today), tone: "text-text-2" },
  ].filter((g) => g.items.length > 0);

  const total = invoices.reduce((sum, i) => sum + i.owed, 0);

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={
          membership.permissions.can_see_earnings && total > 0 ? (
            <>
              {t("totalOwed")}: <Money paise={total} className="font-semibold text-text" />
            </>
          ) : undefined
        }
      />
      {groups.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t("empty")} body={t("emptyBody")} />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`fees-${g.key}`}>
              <h2 id={`fees-${g.key}`} className={cn("mb-2 flex items-center gap-2 text-base font-semibold", g.tone)}>
                {g.title}
                <span className="rounded-full bg-surface-2 px-2 text-sm text-text-2 tabular">{g.items.length}</span>
              </h2>
              <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
                {g.items.map((inv) => (
                  <FeeRow key={inv.id} inv={inv} today={today} locale={locale} t={t} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function FeeRow({
  inv,
  today,
  locale,
  t,
}: {
  inv: OpenInvoice;
  today: string;
  locale: AppLocale;
  t: Awaited<ReturnType<typeof getTranslations<"fees">>>;
}) {
  const late = daysBetween(inv.dueDate, today);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar name={inv.studentName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold">{inv.studentName}</p>
        <p className={cn("text-sm", late > 0 ? "font-medium text-danger" : "font-medium text-warning")}>
          {late > 0 ? t("pendingSince", { days: late }) : t("dueIn", { days: -late })}
        </p>
        <p className="truncate text-sm text-text-2">
          {inv.seatLabel ? `${inv.seatLabel} · ` : ""}
          {formatDay(inv.dueDate, locale)}
          {inv.amountPaid > 0 ? ` · ${t("partPaid", { paid: formatINR(inv.amountPaid) })}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Money paise={inv.owed} className="text-lg font-bold" />
        <a
          href={`tel:${inv.phone}`}
          aria-label={t("callA11y", { name: inv.studentName })}
          className={buttonVariants({ variant: "secondary", size: "sm", className: "h-9" })}
        >
          <Phone aria-hidden />
          {t("call")}
        </a>
      </div>
    </li>
  );
}

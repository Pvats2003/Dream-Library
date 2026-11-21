"use client";

import { AlertCircle, CalendarClock, ChevronRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { logReminder } from "@/actions/fees";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { EndingPlan, OpenInvoice } from "@/lib/data/fees";
import { daysBetween, formatDay, type AppLocale } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { buildReminder } from "@/lib/reminders";
import type { TemplateKey } from "@/lib/templates";
import { waLink } from "@/lib/whatsapp";

const MAX = 5;

/** "Dhyan dein": who owes money and whose plan ends this week, one action each. */
export function AttentionList({
  overdue,
  ending,
  today,
  libraryName,
  templates,
  showMoney,
}: {
  overdue: OpenInvoice[];
  ending: EndingPlan[];
  today: string;
  libraryName: string;
  templates: Record<TemplateKey, string>;
  showMoney: boolean;
}) {
  const t = useTranslations("today");
  const locale = useLocale() as AppLocale;
  const ctx = () => ({ today, locale, libraryName, origin: window.location.origin, templates });

  const rows = [
    ...overdue.map((inv) => ({
      key: inv.id,
      kind: "overdue" as const,
      studentId: inv.studentId,
      name: inv.studentName,
      line: showMoney
        ? t("owesSince", { amount: formatINR(inv.owed), days: daysBetween(inv.dueDate, today) })
        : t("pendingDays", { days: daysBetween(inv.dueDate, today) }),
      send: () => {
        const { key, text } = buildReminder(
          { studentName: inv.studentName, seatLabel: inv.seatLabel, owedPaise: inv.owed, dueDate: inv.dueDate, payToken: inv.payToken },
          ctx(),
        );
        window.open(waLink(inv.phone, text), "_blank", "noopener");
        void logReminder({ studentId: inv.studentId, invoiceId: inv.id, templateKey: key, body: text });
      },
    })),
    ...ending.map((p) => ({
      key: p.subscriptionId,
      kind: "ending" as const,
      studentId: p.studentId,
      name: p.studentName,
      line: t("planEnds", { date: formatDay(p.endDate, locale) }),
      send: () => {
        const { key, text } = buildReminder({ studentName: p.studentName, seatLabel: p.seatLabel, owedPaise: p.pricePaise, endDate: p.endDate }, ctx());
        window.open(waLink(p.phone, text), "_blank", "noopener");
        void logReminder({ studentId: p.studentId, invoiceId: null, templateKey: key, body: text });
      },
    })),
  ];
  const shown = rows.slice(0, MAX);

  return (
    <section aria-labelledby="attention" className="rounded-[20px] border border-border bg-surface shadow-sm">
      <header className="flex items-baseline justify-between gap-3 px-5 pt-5 pb-2">
        <h2 id="attention" className="text-xl font-semibold">
          {t("attention")}
        </h2>
        <span className="text-[15px] text-text-2 tabular">{t("attentionCount", { count: rows.length })}</span>
      </header>
      <ul className="divide-y divide-border">
        {shown.map((r) => (
          <li key={r.key} className="flex items-center gap-3 px-5 py-3">
            <Link href={`/students/${r.studentId}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px]">
              <Avatar name={r.name} className="size-11 text-[15px]" />
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold">{r.name}</span>
                <span className={r.kind === "overdue" ? "flex items-start gap-1 text-[15px] leading-snug text-danger" : "flex items-start gap-1 text-[15px] leading-snug text-warning"}>
                  {r.kind === "overdue" ? <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CalendarClock className="mt-0.5 size-4 shrink-0" aria-hidden />}
                  <span className="tabular">{r.line}</span>
                </span>
              </span>
            </Link>
            <Button variant="secondary" size="sm" className="h-12 shrink-0 text-[15px]" onClick={r.send}>
              <MessageCircle aria-hidden />
              {t("remind")}
            </Button>
          </li>
        ))}
      </ul>
      {rows.length > 0 ? (
        <Link href="/fees" className="flex h-14 items-center justify-center gap-1 border-t border-border text-base font-semibold text-brand">
          {rows.length > MAX ? t("seeAll", { count: rows.length }) : t("seeFees")}
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

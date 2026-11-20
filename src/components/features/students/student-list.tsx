"use client";

import { Search, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useMemo, useState } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Segmented } from "@/components/ui/segmented";
import { StatusPill } from "@/components/ui/status-pill";
import { addDays, formatDay, type AppLocale } from "@/lib/dates";
import { formatMobile } from "@/lib/phone";

export type StudentRow = {
  id: string;
  name: string;
  phone: string;
  status: "active" | "paused" | "left";
  examTarget: string | null;
  seatLabel: string | null;
  shiftName: string | null;
  endDate: string | null;
  owes: boolean;
};

export function StudentList({ students, today }: { students: StudentRow[]; today: string }) {
  const t = useTranslations("students");
  const ts = useTranslations("seats");
  const locale = useLocale() as AppLocale;
  const [filter, setFilter] = useState<"current" | "left">("current");
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());

  const shown = useMemo(() => {
    const digits = q.replace(/\D/g, "");
    return students.filter((s) => {
      if (filter === "current" ? s.status === "left" : s.status !== "left") return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (digits.length >= 3 && s.phone.includes(digits)) ||
        s.seatLabel?.toLowerCase() === q
      );
    });
  }, [students, filter, q]);

  const soon = addDays(today, 7);

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text-3" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-12 w-full rounded-[12px] border border-border bg-surface pr-4 pl-12 text-base placeholder:text-text-3 focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
        />
      </div>
      <Segmented
        className="mt-3"
        label={t("title")}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "current", label: t("filterActive") },
          { value: "left", label: t("filterLeft") },
        ]}
      />

      {shown.length === 0 ? (
        <EmptyState icon={Users} title={q ? t("noMatch", { query }) : t("empty")} />
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
          {shown.map((s) => {
            const ended = s.endDate !== null && s.endDate < today;
            return (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={s.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{s.name}</p>
                  <p className="truncate text-sm text-text-2">
                    {s.seatLabel ? t("seat", { label: s.seatLabel }) : t("noSeat")}
                    {s.shiftName ? ` · ${s.shiftName}` : ""}
                  </p>
                  <p className="truncate text-sm text-text-3 tabular">
                    {s.endDate
                      ? `${ended ? t("endedOn", { date: formatDay(s.endDate, locale) }) : t("endsOn", { date: formatDay(s.endDate, locale) })} · `
                      : ""}
                    {formatMobile(s.phone)}
                  </p>
                </div>
                {s.status === "left" ? (
                  <StatusPill status="left" label={t("statusLeft")} />
                ) : s.owes ? (
                  <StatusPill status="overdue" label={ts("overdue")} />
                ) : s.status === "paused" ? (
                  <StatusPill status="paused" label={t("statusPaused")} />
                ) : s.endDate && !ended && s.endDate <= soon ? (
                  <StatusPill status="expiring" label={ts("expiring")} />
                ) : (
                  <StatusPill status="paid" label={t("statusActive")} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

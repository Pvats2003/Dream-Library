"use client";

import { Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState } from "@/components/patterns/empty-state";
import { useAdmit } from "@/components/features/admit/admit-provider";
import { Button } from "@/components/ui/button";
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
  photoUrl: string | null;
};

export function StudentList({
  students,
  today,
}: {
  students: StudentRow[];
  today: string;
}) {
  const t = useTranslations("students");
  const openAdmit = useAdmit();
  const router = useRouter();
  const pathname = usePathname();
  const ts = useTranslations("seats");
  const locale = useLocale() as AppLocale;
  const [filter, setFilter] = useState<"current" | "left">("current");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  // Someone may start typing before the page has finished loading: keep it.
  useEffect(() => {
    const typed = searchRef.current?.value ?? "";
    if (typed) setQuery(typed);
  }, []);
  const q = useDeferredValue(query.trim().toLowerCase());

  const shown = useMemo(() => {
    const digits = q.replace(/\D/g, "");
    return students.filter((s) => {
      if (filter === "current" ? s.status === "left" : s.status !== "left")
        return false;
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
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-text-3"
          aria-hidden
        />
        <input
          ref={searchRef}
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
        q ? (
          <EmptyState icon={Users} title={t("noMatch", { query })} />
        ) : (
          <EmptyState
            art="books"
            title={t("empty")}
            body={t("emptyBody")}
            action={
              <Button block onClick={() => openAdmit()}>
                <Plus aria-hidden />
                {t("emptyAction")}
              </Button>
            }
          />
        )
      ) : (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
          {shown.map((s) => {
            const ended = s.endDate !== null && s.endDate < today;
            return (
              <li key={s.id}>
                <Link
                  href={`/students/${s.id}`}
                  onPointerDown={() => router.prefetch(`/students/${s.id}`)}
                  onMouseEnter={() => router.prefetch(`/students/${s.id}`)}
                  aria-current={pathname === `/students/${s.id}` ? "page" : undefined}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 active:bg-surface-2 aria-[current=page]:bg-brand-soft aria-[current=page]:shadow-[inset_3px_0_0_var(--brand)]"
                >
                  <Avatar name={s.name} src={s.photoUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-semibold">{s.name}</p>
                    <p className="truncate text-sm text-text-2">
                      {s.seatLabel
                        ? t("seat", { label: s.seatLabel })
                        : t("noSeat")}
                      {s.shiftName ? ` · ${s.shiftName}` : ""}
                    </p>
                    <p className="truncate text-sm text-text-3 tabular">
                      {s.endDate
                        ? `${ended ? t("endedOn", { date: formatDay(s.endDate, locale) }) : t("endsOn", { date: formatDay(s.endDate, locale) })}`
                        : ""}
                      <span className="hidden sm:inline">{s.endDate ? " · " : ""}{formatMobile(s.phone)}</span>
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
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

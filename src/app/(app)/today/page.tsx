import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Check,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/patterns/money";
import { ShiftRing } from "@/components/patterns/shift-ring";
import { cn } from "@/lib/cn";
import { formatMinutesShort, todayInTz, type AppLocale } from "@/lib/dates";
import { getShifts } from "@/lib/data/library";
import { countPendingRequests } from "@/lib/data/requests";
import { RequestsBanner } from "@/components/patterns/requests-banner";
import { getTodaySummary } from "@/lib/data/today";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Aaj" };

function greetingKey(
  tz: string,
): "greetingMorning" | "greetingDay" | "greetingEvening" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (hour >= 4 && hour < 12) return "greetingMorning";
  if (hour >= 17 && hour < 23) return "greetingEvening";
  return "greetingDay";
}

export default async function TodayPage() {
  const { membership } = await requireLibrary();
  const library = {
    name: membership.libraryName,
    timezone: membership.timezone,
  };
  const today = todayInTz(membership.timezone);
  const [t, locale, tSeats] = await Promise.all([
    getTranslations("today"),
    getLocale(),
    getTranslations("seats"),
  ]);
  const [s, shifts, pendingRequests] = await Promise.all([
    getTodaySummary(membership.libraryId, today),
    getShifts(membership.libraryId),
    countPendingRequests(membership.libraryId),
  ]);
  const hours = (id: string) => {
    const sh = shifts.find((x) => x.id === id);
    return sh
      ? `${formatMinutesShort(sh.startMin, locale as AppLocale)} – ${formatMinutesShort(sh.endMin, locale as AppLocale)}`
      : undefined;
  };
  const dateLabel = new Intl.DateTimeFormat(
    locale === "hi" ? "hi-IN" : "en-IN",
    {
      timeZone: library.timezone,
      weekday: "long",
      day: "numeric",
      month: "long",
    },
  ).format(new Date());

  const fullDay = s.seats.find((x) => x.full_day);
  const parts = s.seats.filter((x) => !x.full_day);

  return (
    <div>
      <header className="pt-6 pb-5 lg:pt-10">
        <p className="text-base text-text-2 lg:hidden">{library.name}</p>
        <h1 className="text-2xl font-bold tracking-tight lg:text-[32px] lg:leading-10">
          {t(greetingKey(library.timezone))}
        </h1>
        <p className="mt-1 text-base text-text-2">{dateLabel}</p>
      </header>

      <RequestsBanner count={pendingRequests} />

      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4"
        aria-label={t("allClear")}
      >
        <StatCard
          tone="success"
          Icon={Check}
          label={
            s.can_see_money ? t("collectedToday") : t("paymentsTodayLabel")
          }
          value={
            s.can_see_money ? (
              <Money paise={s.collected_today ?? 0} />
            ) : (
              <span className="tabular">{s.payments_today}</span>
            )
          }
          detail={
            s.can_see_money
              ? t("paymentsToday", { count: s.payments_today })
              : ""
          }
        />
        <StatCard
          tone="danger"
          Icon={AlertCircle}
          href="/fees"
          label={t("overdue")}
          value={
            s.can_see_money ? (
              <Money paise={s.overdue_paise ?? 0} />
            ) : (
              <span className="tabular">{s.overdue_students}</span>
            )
          }
          detail={
            s.can_see_money
              ? t("overdueStudents", { count: s.overdue_students })
              : t("studentsUnit")
          }
          muted={s.overdue_students === 0}
        />
        <StatCard
          tone="warning"
          Icon={CalendarClock}
          href="/fees"
          label={t("dueThisWeek")}
          value={
            s.can_see_money ? (
              <Money paise={s.due_week_paise ?? 0} />
            ) : (
              <span className="tabular">{s.due_week_students}</span>
            )
          }
          detail={
            !s.can_see_money
              ? t("studentsUnit")
              : s.ending_week > 0
                ? t("endingThisWeek", { count: s.ending_week })
                : t("dueStudents", { count: s.due_week_students })
          }
          muted={s.due_week_students === 0}
        />
        <StatCard
          tone="brand"
          Icon={UserRound}
          href="/seats"
          label={t("seatsFree")}
          value={
            <span className="tabular">
              {fullDay ? fullDay.free : (parts[0]?.free ?? 0)}
            </span>
          }
          detail={fullDay ? t("fullDay") : (parts[0]?.name ?? "")}
        />
      </section>

      {parts.length > 0 ? (
        <Card className="mt-4 p-5 lg:mt-6">
          <div className="flex items-baseline justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t("seatsFree")}</h2>
              <p className="text-sm text-text-2 tabular">
                {t("totalSeats", { count: parts[0].total })}
              </p>
            </div>
            <Link
              href="/seats"
              className="inline-flex h-10 items-center gap-1 text-sm font-semibold text-brand"
            >
              {t("seeSeats")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:justify-around">
            {parts.map((x) => (
              <ShiftRing
                key={x.shift_id}
                free={x.free}
                total={x.total}
                label={x.name}
                sublabel={hours(x.shift_id)}
                ariaLabel={`${x.name}: ${tSeats("freeCount", { count: x.free })}`}
              />
            ))}
          </div>
        </Card>
      ) : null}

      <p className="mt-6 flex items-center gap-2 text-base text-text-2">
        <span
          className={cn(
            "size-2.5 rounded-full",
            s.in_library_now > 0 ? "bg-success" : "bg-border-strong",
          )}
          aria-hidden
        />
        {t("inLibraryNow", { count: s.in_library_now })}
        <span className="text-text-3">·</span>
        {t("activeStudents", { count: s.active_students })}
      </p>
    </div>
  );
}

const TONES = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  brand: "bg-brand-soft text-brand-soft-fg",
} as const;

function StatCard({
  tone,
  Icon,
  label,
  value,
  detail,
  href,
  muted,
}: {
  tone: keyof typeof TONES;
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  detail: string;
  href?: string;
  muted?: boolean;
}) {
  const body = (
    <Card
      className={cn(
        "flex h-full flex-col p-4 lg:p-5",
        href &&
          "transition-[transform,border-color] duration-150 hover:border-border-strong active:scale-[0.98]",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full",
          muted ? "bg-surface-2 text-text-3" : TONES[tone],
        )}
      >
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="mt-3 text-sm font-medium text-text-2">{label}</span>
      <span className="mt-0.5 text-[26px] leading-9 font-bold tracking-tight lg:text-[32px] lg:leading-10">
        {value}
      </span>
      <span className="mt-auto pt-1 text-sm text-text-2">{detail}</span>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-[14px]">
      {body}
    </Link>
  ) : (
    body
  );
}

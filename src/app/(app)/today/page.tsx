import { AlertCircle, ArrowRight, Armchair, IndianRupee } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AllClear } from "@/components/features/today/all-clear";
import { AttentionList } from "@/components/features/today/attention-list";
import { CountUp } from "@/components/features/today/count-up";
import { RequestsBanner } from "@/components/patterns/requests-banner";
import { ShiftRing } from "@/components/patterns/shift-ring";
import { cn } from "@/lib/cn";
import { formatMinutesShort, todayInTz, type AppLocale } from "@/lib/dates";
import { getEndingSoon, getOpenInvoices, getTemplates } from "@/lib/data/fees";
import { getShifts } from "@/lib/data/library";
import { countPendingRequests } from "@/lib/data/requests";
import { getTodaySummary } from "@/lib/data/today";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Aaj" };

function greetingKey(tz: string): "greetingMorning" | "greetingDay" | "greetingEvening" {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  if (hour >= 4 && hour < 12) return "greetingMorning";
  if (hour >= 17 && hour < 23) return "greetingEvening";
  return "greetingDay";
}

export default async function TodayPage() {
  const { membership } = await requireLibrary();
  const today = todayInTz(membership.timezone);
  const locale = (await getLocale()) as AppLocale;
  const [t, tSeats, s, shifts, pendingRequests, open, ending, templates] = await Promise.all([
    getTranslations("today"),
    getTranslations("seats"),
    getTodaySummary(membership.libraryId, today),
    getShifts(membership.libraryId),
    countPendingRequests(membership.libraryId),
    getOpenInvoices(membership.libraryId, today),
    getEndingSoon(membership.libraryId, today),
    getTemplates(membership.libraryId, locale),
  ]);
  const libraryName = membership.libraryName;
  const hours = (id: string) => {
    const sh = shifts.find((x) => x.id === id);
    return sh ? `${formatMinutesShort(sh.startMin, locale)} – ${formatMinutesShort(sh.endMin, locale)}` : undefined;
  };
  const dateLabel = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: membership.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  const fullDay = s.seats.find((x) => x.full_day);
  const parts = s.seats.filter((x) => !x.full_day);
  const freeSeats = fullDay ? fullDay.free : (parts[0]?.free ?? 0);
  const overdue = open.invoices.filter((i) => i.dueDate < today);
  const allClear = s.overdue_students === 0 && s.due_week_students === 0 && s.active_students > 0;
  const name = membership.displayName && membership.displayName !== "Owner" ? membership.displayName.split(" ")[0] : null;
  const greeting = t(greetingKey(membership.timezone));

  return (
    <div className="pb-6">
      <header className="pt-7 pb-6 lg:pt-12 lg:pb-8">
        <p className="text-[15px] font-medium text-text-2 lg:hidden">{libraryName}</p>
        <h1 className="mt-1 font-display text-[34px] leading-[1.2] font-medium tracking-tight text-balance lg:text-[44px]">
          {name ? t("greetName", { greeting, name }) : greeting}
        </h1>
        <p className="mt-1.5 text-base text-text-2">{dateLabel}</p>
      </header>

      <RequestsBanner count={pendingRequests} />

      <section
        aria-label={t("allClear")}
        className="grid grid-cols-2 rounded-[20px] border border-border bg-surface shadow-sm sm:grid-cols-3"
      >
        <BigNumber
          wide
          Icon={IndianRupee}
          tone="text-success"
          label={s.can_see_money ? t("collectionToday") : t("paymentsTodayLabel")}
          value={s.can_see_money ? <CountUp value={s.collected_today ?? 0} money /> : <CountUp value={s.payments_today} />}
          detail={s.can_see_money ? t("paymentsToday", { count: s.payments_today }) : ""}
        />
        <BigNumber
          Icon={AlertCircle}
          tone={s.overdue_students > 0 ? "text-danger" : "text-text-3"}
          href="/fees"
          label={t("feesPending")}
          value={s.can_see_money ? <CountUp value={s.overdue_paise ?? 0} money /> : <CountUp value={s.overdue_students} />}
          detail={s.can_see_money ? t("overdueStudents", { count: s.overdue_students }) : t("studentsUnit")}
        />
        <BigNumber
          Icon={Armchair}
          tone="text-brand"
          href="/seats"
          label={t("seatsFree")}
          value={<CountUp value={freeSeats} />}
          detail={fullDay ? t("fullDay") : (parts[0]?.name ?? "")}
        />
      </section>

      <div className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="space-y-5">
          {allClear ? <AllClear title={t("allDoneTitle")} body={t("allDoneBody")} /> : null}
          {overdue.length + ending.length > 0 ? (
            <AttentionList
              overdue={overdue}
              ending={ending}
              today={today}
              libraryName={libraryName}
              templates={templates}
              showMoney={s.can_see_money}
            />
          ) : null}
        </div>

        {parts.length > 0 ? (
          <section className="rounded-[20px] border border-border bg-surface p-5 shadow-sm" aria-labelledby="shifts">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h2 id="shifts" className="text-xl font-semibold">
                  {t("shiftsTitle")}
                </h2>
                <p className="text-[15px] text-text-2 tabular">{t("totalSeats", { count: parts[0].total })}</p>
              </div>
              <Link href="/seats" className="inline-flex h-11 shrink-0 items-center gap-1 text-[15px] font-semibold text-brand">
                {t("seeSeats")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-2 gap-y-5 min-[460px]:grid-cols-4 lg:grid-cols-2">
              {s.seats.map((x) => (
                <ShiftRing
                  key={x.shift_id}
                  free={x.free}
                  total={x.total}
                  label={x.full_day ? t("fullDay") : x.name}
                  sublabel={x.full_day ? undefined : hours(x.shift_id)}
                  ariaLabel={`${x.name}: ${tSeats("freeCount", { count: x.free })}`}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <p className="mt-6 flex flex-wrap items-center gap-2 text-base text-text-2">
        <span className={cn("size-2.5 rounded-full", s.in_library_now > 0 ? "bg-success" : "bg-border-strong")} aria-hidden />
        {t("inLibraryNow", { count: s.in_library_now })}
        <span className="text-text-3">·</span>
        {t("activeStudents", { count: s.active_students })}
      </p>
    </div>
  );
}

function BigNumber({
  Icon,
  tone,
  label,
  value,
  detail,
  href,
  wide,
}: {
  wide?: boolean;
  Icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: React.ReactNode;
  detail: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-[15px] font-medium text-text-2">
        <Icon className={cn("size-5", tone)} aria-hidden />
        {label}
      </span>
      <span className={cn("mt-2 block leading-none font-bold tracking-tight lg:text-[48px]", wide ? "text-[44px]" : "text-[32px] sm:text-[40px]")}>{value}</span>
      <span className="mt-2 flex items-center justify-between text-[15px] text-text-2">
        {detail}
        {href ? <ArrowRight className="size-4 text-text-3" aria-hidden /> : null}
      </span>
    </>
  );
  // Phone: the day's collection across the top, the other two side by side.
  const cls = cn(
    "block px-5 py-5 lg:px-6 lg:py-6",
    wide ? "col-span-2 border-b border-border sm:col-span-1 sm:border-b-0" : "border-border last:border-l sm:border-l",
  );
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-surface-hover last:rounded-br-[20px] sm:last:rounded-tr-[20px]")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

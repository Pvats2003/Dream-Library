/**
 * Calendar-date helpers.
 *
 * Plan periods are plain calendar dates in the library's own timezone,
 * passed around as ISO strings ("2026-12-05"). Moments (payments, check-ins)
 * are real timestamps and are converted to a calendar date only for display
 * or for "which day did this happen on" questions. See PLAN.md §2.4.
 */

export type ISODate = string & { readonly __isoDate?: unique symbol };

export const DEFAULT_TZ = "Asia/Kolkata";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseISODate(iso: string): { y: number; m: number; d: number } {
  const match = ISO_RE.exec(iso);
  if (!match) throw new Error(`Not an ISO date: ${iso}`);
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) {
    throw new Error(`Not a real date: ${iso}`);
  }
  return { y, m, d };
}

export function toISODate(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` as ISODate;
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** m is 1-12. */
export function daysInMonth(y: number, m: number): number {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

/** Days since 1970-01-01 for a calendar date (timezone-free arithmetic). */
function toDayNumber(iso: string): number {
  const { y, m, d } = parseISODate(iso);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromDayNumber(n: number): ISODate {
  const dt = new Date(n * 86_400_000);
  return toISODate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(iso: string, days: number): ISODate {
  return fromDayNumber(toDayNumber(iso) + days);
}

/** b - a in whole days. */
export function daysBetween(a: string, b: string): number {
  return toDayNumber(b) - toDayNumber(a);
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Move a date by whole months, landing on `billingDay` (clamped to the
 * month's length). A student who joined on the 31st stays on the 31st
 * whenever the month has one: 31 Jan → 28 Feb → 31 Mar.
 */
export function addMonthsOnBillingDay(iso: string, months: number, billingDay: number): ISODate {
  const { y, m } = parseISODate(iso);
  const zeroBased = y * 12 + (m - 1) + months;
  const ny = Math.floor(zeroBased / 12);
  const nm = (zeroBased % 12) + 1;
  return toISODate(ny, nm, Math.min(billingDay, daysInMonth(ny, nm)));
}

export type Duration = { months: number; days?: never } | { days: number; months?: never };

/**
 * The inclusive period a plan covers, and the date the next one starts.
 * A 1-month plan from 5 Dec covers 5 Dec–4 Jan; the next starts 5 Jan.
 */
export function planPeriod(
  start: string,
  duration: Duration,
  billingDay: number = parseISODate(start).d,
): { start: ISODate; end: ISODate; nextStart: ISODate } {
  const nextStart =
    duration.months !== undefined
      ? addMonthsOnBillingDay(start, duration.months, billingDay)
      : addDays(start, duration.days);
  return { start: start as ISODate, end: addDays(nextStart, -1), nextStart };
}

/** The calendar date a moment falls on in a timezone (default IST). */
export function dateInTz(moment: Date, tz: string = DEFAULT_TZ): ISODate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment) as ISODate;
}

export function todayInTz(tz: string = DEFAULT_TZ, now: Date = new Date()): ISODate {
  return dateInTz(now, tz);
}

/** UTC instants bounding a local calendar day: [start, end). */
export function dayBoundsUtc(iso: string, tz: string = DEFAULT_TZ): { start: Date; end: Date } {
  const offset = tzOffsetMinutes(iso, tz);
  const { y, m, d } = parseISODate(iso);
  const start = new Date(Date.UTC(y, m - 1, d) - offset * 60_000);
  const next = parseISODate(addDays(iso, 1));
  const end = new Date(Date.UTC(next.y, next.m - 1, next.d) - tzOffsetMinutes(addDays(iso, 1), tz) * 60_000);
  return { start, end };
}

/** Offset of `tz` from UTC in minutes at local midnight of `iso` (IST = +330). */
function tzOffsetMinutes(iso: string, tz: string): number {
  const { y, m, d } = parseISODate(iso);
  const probe = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(probe);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return Math.round((asUtc - probe.getTime()) / 60_000);
}

export type AppLocale = "hi" | "en";

/** "5 Dec" / "5 दिसंबर", optionally with the year. */
export function formatDay(iso: string, locale: AppLocale, opts: { year?: boolean } = {}): string {
  const { y, m, d } = parseISODate(iso);
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "UTC",
    day: "numeric",
    month: locale === "hi" ? "long" : "short",
    ...(opts.year ? { year: "numeric" } : {}),
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "6:00 AM" style from minutes after midnight. */
export function formatMinutes(min: number, locale: AppLocale): string {
  const h = Math.floor(min / 60) % 24;
  const mm = min % 60;
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "UTC",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(Date.UTC(2000, 0, 1, h, mm)));
}

/** Compact: "6 am", "12:30 pm" — drops ":00". */
export function formatMinutesShort(min: number, locale: AppLocale): string {
  const h = Math.floor(min / 60) % 24;
  const mm = min % 60;
  return new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: "UTC",
    hour: "numeric",
    ...(mm ? { minute: "2-digit" } : {}),
    hour12: true,
  }).format(new Date(Date.UTC(2000, 0, 1, h, mm)));
}

export function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(hhmm: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!match) throw new Error(`Bad time: ${hhmm}`);
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 24 || m > 59 || (h === 24 && m > 0)) throw new Error(`Bad time: ${hhmm}`);
  return h * 60 + m;
}

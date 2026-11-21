/**
 * Turning the library's data into spreadsheets (Excel and CSV) for backup
 * or for the owner's own use. Pure functions only: no database, no React.
 */

export type ColType = "text" | "money" | "date" | "datetime" | "number";
export type Value = string | number | null;
export type Column = { header: string; type: ColType; width?: number };
export type Sheet = { key: SheetKey; title: string; columns: Column[]; rows: Value[][] };

export const SHEET_KEYS = ["students", "plans", "fees", "payments", "attendance", "seats"] as const;
export type SheetKey = (typeof SHEET_KEYS)[number];

/** Money is stored as whole paise; spreadsheets get rupees (₹1,200.50 → 1200.5). */
export function rupees(paise: number | null | undefined): number | null {
  return paise == null ? null : Math.round(paise) / 100;
}

/** "2026-11-21 18:05" in the library's own time zone (sorts correctly as text too). */
export function localDateTime(iso: string | null | undefined, timeZone: string): string | null {
  if (!iso) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * A cell that starts with = + - @ (or a tab/return) would run as a formula
 * when the CSV is opened in Excel. Names come from students themselves via
 * the QR form, so text is always defused with a leading apostrophe.
 */
export function safeText(s: string): string {
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

function csvCell(v: Value, type: ColType): string {
  if (v === null || v === "") return "";
  const s = typeof v === "number" ? String(v) : type === "text" ? safeText(v) : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV that opens correctly in Excel and Google Sheets, Hindi included:
 * UTF-8 with a byte-order mark, comma separated, Windows line endings.
 */
export function toCsv(sheet: Sheet): string {
  const lines = [sheet.columns.map((c) => csvCell(c.header, "text")).join(",")];
  for (const row of sheet.rows) lines.push(sheet.columns.map((c, i) => csvCell(row[i] ?? null, c.type)).join(","));
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** File names stay plain English letters so every phone and computer can save them. */
export function fileName(libraryName: string, part: string, today: string, ext: "csv" | "xlsx"): string {
  const slug =
    libraryName
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "library";
  return `${slug}-${part}-${today}.${ext}`;
}

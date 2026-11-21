import "server-only";
import ExcelJS from "exceljs";
import type { Sheet } from "@/lib/export";

const INR = '"₹"#,##0.00;-"₹"#,##0.00';

/** "2026-11-21" or "2026-11-21 18:05" → a real Excel date (kept as written, no time-zone shift). */
function toDate(s: string): Date {
  const [d, time = "00:00"] = s.split(" ");
  const [y, m, day] = d.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, day, h, min));
}

/**
 * One Excel file with a tab per sheet: bold frozen header, rupees and
 * dates as real numbers and dates (so sums and sorting work), mobile
 * numbers kept as text so no digits are lost.
 */
export async function toXlsx(sheets: Sheet[], creator: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = creator;
  wb.created = new Date();
  for (const sheet of sheets) {
    const name = sheet.title.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = sheet.columns.map((c) => ({
      header: c.header,
      width: c.width ?? (c.type === "datetime" ? 18 : c.type === "date" ? 13 : 14),
      style:
        c.type === "money"
          ? { numFmt: INR }
          : c.type === "date"
            ? { numFmt: "dd-mm-yyyy" }
            : c.type === "datetime"
              ? { numFmt: "dd-mm-yyyy hh:mm" }
              : {},
    }));
    for (const row of sheet.rows) {
      ws.addRow(
        sheet.columns.map((c, i) => {
          const v = row[i];
          if (v === null || v === undefined || v === "") return null;
          if ((c.type === "date" || c.type === "datetime") && typeof v === "string") return toDate(v);
          return v;
        }),
      );
    }
    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B3FB6" } };
    head.height = 22;
    head.alignment = { vertical: "middle" };
    if (sheet.rows.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

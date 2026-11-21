import { describe, expect, it } from "vitest";
import { fileName, localDateTime, rupees, safeText, toCsv, type Sheet } from "@/lib/export";

const sheet: Sheet = {
  key: "students",
  title: "Students",
  columns: [
    { header: "नाम", type: "text" },
    { header: "₹", type: "money" },
    { header: "Date", type: "date" },
  ],
  rows: [
    ["क्षितिज श्रीवास्तव", 1200, "2026-11-21"],
    ['Rahul "Raju", Kumar', 1200.5, null],
    ["=HYPERLINK(\"x\")", -600, "2026-01-02"],
  ],
};

describe("spreadsheet export", () => {
  it("turns paise into rupees without losing paise", () => {
    expect(rupees(120000)).toBe(1200);
    expect(rupees(120050)).toBe(1200.5);
    expect(rupees(-60000)).toBe(-600);
    expect(rupees(null)).toBeNull();
  });

  it("writes CSV that Excel opens with Hindi intact", () => {
    const csv = toCsv(sheet);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe("नाम,₹,Date");
    expect(lines[1]).toBe("क्षितिज श्रीवास्तव,1200,2026-11-21");
    expect(lines[2]).toBe('"Rahul ""Raju"", Kumar",1200.5,');
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("never lets a name run as a formula, but keeps negative money as a number", () => {
    const line = toCsv(sheet).split("\r\n")[3];
    expect(line).toBe(`"'=HYPERLINK(""x"")",-600,2026-01-02`);
    expect(safeText("+91 98765")).toBe("'+91 98765");
    expect(safeText("-")).toBe("'-");
    expect(safeText("Rahul")).toBe("Rahul");
  });

  it("shows times in the library's time zone", () => {
    expect(localDateTime("2026-11-21T12:35:00Z", "Asia/Kolkata")).toBe("2026-11-21 18:05");
    expect(localDateTime(null, "Asia/Kolkata")).toBeNull();
  });

  it("makes plain, safe file names", () => {
    expect(fileName("Dream Library", "students", "2026-11-21", "csv")).toBe("Dream-Library-students-2026-11-21.csv");
    expect(fileName("ड्रीम लाइब्रेरी", "all", "2026-11-21", "xlsx")).toBe("library-all-2026-11-21.xlsx");
  });
});

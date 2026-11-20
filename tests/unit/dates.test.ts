import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonthsOnBillingDay,
  dateInTz,
  dayBoundsUtc,
  daysBetween,
  formatDay,
  formatMinutes,
  hhmmToMinutes,
  parseISODate,
  planPeriod,
} from "@/lib/dates";

describe("planPeriod", () => {
  it("covers 5 Dec to 4 Jan for a 1-month plan", () => {
    expect(planPeriod("2026-12-05", { months: 1 })).toEqual({
      start: "2026-12-05",
      end: "2027-01-04",
      nextStart: "2027-01-05",
    });
  });

  it("handles quarterly plans", () => {
    expect(planPeriod("2026-11-20", { months: 3 }).end).toBe("2027-02-19");
  });

  it("clamps 31 Jan to 28 Feb and returns to the 31st in March", () => {
    const first = planPeriod("2027-01-31", { months: 1 });
    expect(first.nextStart).toBe("2027-02-28");
    expect(first.end).toBe("2027-02-27");
    const second = planPeriod(first.nextStart, { months: 1 }, 31);
    expect(second.nextStart).toBe("2027-03-31");
    const third = planPeriod(second.nextStart, { months: 1 }, 31);
    expect(third.nextStart).toBe("2027-04-30");
    const fourth = planPeriod(third.nextStart, { months: 1 }, 31);
    expect(fourth.nextStart).toBe("2027-05-31");
  });

  it("uses 29 Feb in a leap year", () => {
    expect(planPeriod("2028-01-31", { months: 1 }).nextStart).toBe("2028-02-29");
    expect(planPeriod("2028-01-30", { months: 1 }).nextStart).toBe("2028-02-29");
  });

  it("crosses the year end", () => {
    expect(addMonthsOnBillingDay("2026-11-30", 3, 30)).toBe("2027-02-28");
    expect(addMonthsOnBillingDay("2026-12-15", 1, 15)).toBe("2027-01-15");
  });

  it("supports day-based plans", () => {
    expect(planPeriod("2026-12-30", { days: 7 })).toEqual({
      start: "2026-12-30",
      end: "2027-01-05",
      nextStart: "2027-01-06",
    });
  });
});

describe("day arithmetic", () => {
  it("adds days across months and leap days", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("counts days between", () => {
    expect(daysBetween("2026-12-01", "2026-12-04")).toBe(3);
    expect(daysBetween("2026-12-04", "2026-12-01")).toBe(-3);
  });

  it("rejects impossible dates", () => {
    expect(() => parseISODate("2027-02-29")).toThrow();
    expect(() => parseISODate("5 Dec")).toThrow();
  });
});

describe("IST around midnight", () => {
  it("puts 23:59 IST on the same day and 00:01 IST on the next", () => {
    // 23:59 IST on 5 Dec = 18:29 UTC on 5 Dec
    expect(dateInTz(new Date("2026-12-05T18:29:00Z"))).toBe("2026-12-05");
    // 00:01 IST on 6 Dec = 18:31 UTC on 5 Dec (still 5 Dec in UTC!)
    expect(dateInTz(new Date("2026-12-05T18:31:00Z"))).toBe("2026-12-06");
  });

  it("gives the UTC bounds of an IST day", () => {
    const { start, end } = dayBoundsUtc("2026-12-06");
    expect(start.toISOString()).toBe("2026-12-05T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-12-06T18:30:00.000Z");
  });
});

describe("display", () => {
  it("formats days in both languages", () => {
    expect(formatDay("2026-12-05", "en")).toBe("5 Dec");
    expect(formatDay("2026-12-05", "hi")).toBe("5 दिसंबर");
    expect(formatDay("2026-12-05", "en", { year: true })).toBe("5 Dec 2026");
  });

  it("formats and parses shift times", () => {
    expect(formatMinutes(360, "en").toLowerCase()).toBe("6:00 am");
    expect(hhmmToMinutes("23:00")).toBe(1380);
    expect(hhmmToMinutes("24:00")).toBe(1440);
    expect(() => hhmmToMinutes("25:00")).toThrow();
  });
});

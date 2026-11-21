import { describe, expect, it } from "vitest";
import { buildReminder, reminderKind } from "@/lib/reminders";
import { DEFAULT_TEMPLATES, type TemplateKey } from "@/lib/templates";

const templates = Object.fromEntries(DEFAULT_TEMPLATES.filter((t) => t.locale === "hi").map((t) => [t.key, t.body])) as Record<TemplateKey, string>;
const ctx = { today: "2026-11-21", locale: "hi" as const, libraryName: "Dream Library", origin: "https://x.app", templates };

describe("reminders", () => {
  it("is gentle up to 3 days late and firm after", () => {
    expect(reminderKind({ studentName: "A", seatLabel: null, owedPaise: 1, dueDate: "2026-11-19" }, ctx.today)).toBe("reminder");
    expect(reminderKind({ studentName: "A", seatLabel: null, owedPaise: 1, dueDate: "2026-11-10" }, ctx.today)).toBe("overdue");
    expect(reminderKind({ studentName: "A", seatLabel: null, owedPaise: 1, endDate: "2026-11-25" }, ctx.today)).toBe("expiring");
  });

  it("fills in first name, amount, date and the pay link", () => {
    const { key, text } = buildReminder(
      { studentName: "Rahul Kumar", seatLabel: "A5", owedPaise: 60000, dueDate: "2026-11-20", payToken: "tok" },
      ctx,
    );
    expect(key).toBe("reminder");
    expect(text).toContain("Rahul ji");
    expect(text).toContain("₹600");
    expect(text).toContain("20 नवंबर");
    expect(text).toContain("https://x.app/p/tok");
    expect(text).not.toMatch(/\{\w+\}/);
  });
});

import { daysBetween, formatDay, type AppLocale } from "./dates";
import { formatINR } from "./money";
import { fillTemplate, type TemplateKey } from "./templates";

export type ReminderInput = {
  studentName: string;
  seatLabel: string | null;
  owedPaise: number;
  dueDate?: string;
  endDate?: string;
  payToken?: string;
};

/** Gentle reminder until 3 days late, firmer after that; plan-ending text otherwise. */
export function reminderKind(r: ReminderInput, today: string): TemplateKey {
  if (!r.dueDate) return "expiring";
  return daysBetween(r.dueDate, today) > 3 ? "overdue" : "reminder";
}

export function buildReminder(
  r: ReminderInput,
  ctx: { today: string; locale: AppLocale; libraryName: string; origin: string; templates: Record<TemplateKey, string> },
): { key: TemplateKey; text: string } {
  const key = reminderKind(r, ctx.today);
  const text = fillTemplate(ctx.templates[key], {
    name: r.studentName.split(" ")[0],
    amount: formatINR(r.owedPaise),
    due_date: r.dueDate ? formatDay(r.dueDate, ctx.locale) : undefined,
    end_date: r.endDate ? formatDay(r.endDate, ctx.locale) : undefined,
    seat: r.seatLabel ?? undefined,
    library: ctx.libraryName,
    upi_link: r.payToken ? `${ctx.origin}/p/${r.payToken}` : undefined,
  });
  return { key, text };
}

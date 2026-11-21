import { AlertCircle, CalendarClock, Check, Circle, Clock, Pause, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export type Status = "paid" | "due" | "overdue" | "expiring" | "upcoming" | "free" | "paused" | "left" | "neutral";

// Status is never colour alone: every pill has an icon and a word.
const STYLES: Record<Status, { cls: string; Icon: LucideIcon }> = {
  paid: { cls: "bg-success-soft text-success", Icon: Check },
  due: { cls: "bg-warning-soft text-warning", Icon: Clock },
  overdue: { cls: "bg-danger-soft text-danger", Icon: AlertCircle },
  expiring: { cls: "bg-warning-soft text-warning", Icon: CalendarClock },
  upcoming: { cls: "bg-info-soft text-info", Icon: CalendarClock },
  free: { cls: "bg-surface-2 text-text-2 border border-border", Icon: Circle },
  paused: { cls: "bg-info-soft text-info", Icon: Pause },
  left: { cls: "bg-surface-2 text-text-3", Icon: Circle },
  neutral: { cls: "bg-surface-2 text-text-2", Icon: Circle },
};

export function StatusPill({ status, label, className }: { status: Status; label: string; className?: string }) {
  const { cls, Icon } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full pl-2.5 pr-3 text-sm font-semibold whitespace-nowrap",
        cls,
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={2.25} aria-hidden />
      {label}
    </span>
  );
}

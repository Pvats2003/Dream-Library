import { AlertCircle, Ban, CalendarClock, Check, Circle, type LucideIcon } from "lucide-react";
import type { ComponentProps, CSSProperties } from "react";
import { cn } from "@/lib/cn";

export type SeatState = "free" | "taken" | "expiring" | "overdue" | "inactive";

/**
 * Every state differs by shape, fill or pattern — never colour alone:
 * free = dashed outline, taken = solid with initials, ending soon = stripes,
 * fees pending = red edge + alert badge, closed = cross-hatch.
 */
export const TILE: Record<SeatState, string> = {
  free: "border-2 border-dashed border-border-heavy bg-surface text-text-2",
  taken: "border-2 border-transparent bg-brand text-brand-fg shadow-[var(--glow)]",
  expiring: "border-2 border-warning bg-warning-soft pattern-stripes text-text shadow-[var(--glow)]",
  overdue: "border-2 border-danger bg-danger-soft text-danger",
  inactive: "border-2 border-border bg-surface-2 pattern-cross text-text-3",
};

export const STATE_ICON: Record<SeatState, LucideIcon> = {
  free: Circle,
  taken: Check,
  expiring: CalendarClock,
  overdue: AlertCircle,
  inactive: Ban,
};

/** The seat as a little desk-and-chair: a desk edge on top, a softer chair-like base. */
export function SeatTile({
  state,
  label,
  initials,
  more = 0,
  className,
  style,
  ...props
}: {
  state: SeatState;
  label: string;
  /** Shown big on occupied seats when there's room. */
  initials?: string;
  /** Other students sharing the seat in other shifts. */
  more?: number;
  style?: CSSProperties;
} & Omit<ComponentProps<"button">, "children">) {
  const showInitials = Boolean(initials) && state !== "free" && state !== "inactive";
  return (
    <button
      type="button"
      className={cn(
        "group relative flex aspect-square w-full min-w-0 flex-col items-center justify-center rounded-t-[8px] rounded-b-[14px] tabular",
        "transition-[transform,background-color,border-color,color,opacity] duration-300 ease-[cubic-bezier(0.34,1.36,0.64,1)] active:scale-95",
        TILE[state],
        className,
      )}
      style={style}
      {...props}
    >
      {/* desk edge */}
      <span aria-hidden className="absolute top-[3px] right-[18%] left-[18%] h-[3px] rounded-full bg-current opacity-30" />
      {showInitials ? (
        <>
          <span className="text-[clamp(13px,38cqw,22px)] leading-none font-bold">{initials}</span>
          <span className="mt-[2px] text-[clamp(10px,22cqw,13px)] leading-none font-semibold opacity-80">{label}</span>
        </>
      ) : (
        <span className={cn("text-[clamp(12px,30cqw,17px)] leading-none font-bold", state === "inactive" && "line-through")}>{label}</span>
      )}
      {state === "overdue" ? (
        <AlertCircle className="absolute -top-1.5 -right-1.5 size-[18px] rounded-full bg-surface text-danger" aria-hidden />
      ) : state === "expiring" ? (
        <CalendarClock className="absolute -top-1.5 -right-1.5 size-[18px] rounded-full bg-surface p-px text-warning" aria-hidden />
      ) : null}
      {more > 0 ? (
        <span className="absolute bottom-[3px] flex gap-0.5" aria-hidden>
          {Array.from({ length: Math.min(more, 3) }, (_, i) => (
            <span key={i} className="size-1 rounded-full bg-current opacity-70" />
          ))}
        </span>
      ) : null}
    </button>
  );
}

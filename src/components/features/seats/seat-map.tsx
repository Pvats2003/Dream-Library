"use client";

import { AlertCircle, Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { addDays } from "@/lib/dates";

export type MapShift = { id: string; name: string; startMin: number; endMin: number; isFullDay: boolean };
export type MapOccupant = { studentName: string; startMin: number; endMin: number; endDate: string; hasDues: boolean };
export type MapSeat = { id: string; label: string; x: number; y: number; isActive: boolean; occupants: MapOccupant[] };
export type MapZone = { id: string | null; name: string; seats: MapSeat[] };

type SeatState = "free" | "taken" | "expiring" | "overdue" | "inactive";

const EXPIRING_DAYS = 7;
const ALL = "all";

function stateFor(seat: MapSeat, range: [number, number] | null, today: string): { state: SeatState; who: MapOccupant[] } {
  if (!seat.isActive) return { state: "inactive", who: [] };
  const who = range ? seat.occupants.filter((o) => o.startMin < range[1] && range[0] < o.endMin) : seat.occupants;
  if (who.length === 0) return { state: "free", who };
  if (who.some((o) => o.hasDues)) return { state: "overdue", who };
  const soon = addDays(today, EXPIRING_DAYS);
  if (who.some((o) => o.endDate <= soon)) return { state: "expiring", who };
  return { state: "taken", who };
}

// Every state differs by fill/pattern and, where it matters, an icon —
// never by colour alone.
const TILE: Record<SeatState, string> = {
  free: "border-2 border-dashed border-border-strong bg-surface text-text-2",
  taken: "border-2 border-transparent bg-brand text-brand-fg",
  expiring: "border-2 border-warning bg-warning-soft pattern-stripes text-text",
  overdue: "border-2 border-danger bg-danger-soft text-danger",
  inactive: "border-2 border-border bg-surface-2 pattern-cross text-text-3 line-through",
};

export function SeatMap({ zones, shifts, today }: { zones: MapZone[]; shifts: MapShift[]; today: string }) {
  const t = useTranslations("seats");
  const [shiftId, setShiftId] = useState<string>(ALL);

  const range = useMemo<[number, number] | null>(() => {
    const s = shifts.find((x) => x.id === shiftId);
    return s ? [s.startMin, s.endMin] : null;
  }, [shiftId, shifts]);

  const computed = useMemo(
    () =>
      zones.map((z) => {
        const seats = z.seats.map((s) => ({ seat: s, ...stateFor(s, range, today) }));
        return { zone: z, seats, free: seats.filter((s) => s.state === "free").length };
      }),
    [zones, range, today],
  );

  return (
    <div>
      <Segmented
        label={t("title")}
        value={shiftId}
        onChange={setShiftId}
        options={[{ value: ALL, label: t("allShifts") }, ...shifts.map((s) => ({ value: s.id, label: s.name }))]}
      />

      <div className="mt-4 flex flex-col gap-4">
        {computed.map(({ zone, seats, free }) => {
          const xs = seats.map((s) => s.seat.x);
          const cols = Math.max(...xs) + 1;
          const used = new Set(xs);
          // Empty columns (aisles) are drawn narrow.
          const template = Array.from({ length: cols }, (_, i) => (used.has(i) ? "minmax(34px, 1fr)" : "10px")).join(" ");
          return (
            <Card key={zone.id ?? "none"} className="-mx-2 p-3 sm:mx-0 sm:p-5">
              <div className="mb-3 flex items-baseline justify-between px-1">
                <h2 className="text-lg font-semibold">{zone.name}</h2>
                <span className="text-sm font-medium text-text-2 tabular">{t("freeCount", { count: free })}</span>
              </div>
              <div className="overflow-x-auto">
                <ul
                  className="grid gap-1 sm:gap-1.5"
                  style={{ gridTemplateColumns: template, maxWidth: used.size * 50 + (cols - used.size) * 10 }}
                >
                  {seats.map(({ seat, state, who }) => (
                    <li
                      key={seat.id}
                      style={{ gridColumnStart: seat.x + 1, gridRowStart: seat.y + 1 }}
                      aria-label={
                        state === "free"
                          ? t("seatFreeA11y", { label: seat.label })
                          : who.length
                            ? t("seatTakenBy", { label: seat.label, name: who.map((w) => w.studentName).join(", ") })
                            : t("seatLabel", { label: seat.label })
                      }
                      title={who.map((w) => w.studentName).join(", ") || undefined}
                      className={cn(
                        "relative grid aspect-square min-w-0 place-items-center rounded-[10px] text-[13px] font-bold tabular sm:text-sm",
                        TILE[state],
                      )}
                    >
                      {seat.label}
                      {state === "overdue" ? (
                        <AlertCircle className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-surface text-danger" aria-hidden />
                      ) : state === "expiring" ? (
                        <Clock className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-surface text-warning" aria-hidden />
                      ) : null}
                      {range === null && who.length > 1 ? (
                        <span className="absolute bottom-0.5 flex gap-0.5" aria-hidden>
                          {who.map((_, i) => (
                            <span key={i} className="size-1 rounded-full bg-current opacity-70" />
                          ))}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          );
        })}
      </div>

      <section className="mt-5" aria-label={t("legend")}>
        <h2 className="mb-2 text-sm font-semibold text-text-2">{t("legend")}</h2>
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {(["free", "taken", "expiring", "overdue", "inactive"] as const).map((s) => (
            <li key={s} className="flex items-center gap-2 text-sm text-text-2">
              <span className={cn("relative size-6 rounded-[6px]", TILE[s])} aria-hidden />
              {t(s)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

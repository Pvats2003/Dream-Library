"use client";

import { ArrowRightLeft, Flame, MessageCircle, Minus, Phone, Plus, UserRound, Venus, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { moveSeat, vacateSeat } from "@/actions/seats";
import { useAdmit } from "@/components/features/admit/admit-provider";
import { SeatTile, STATE_ICON, TILE, type SeatState } from "@/components/features/seats/seat-tile";
import { MiniRing } from "@/components/patterns/shift-ring";
import { Avatar, initials } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { addDays, formatDay, formatMinutesShort, type AppLocale } from "@/lib/dates";
import { phoneDigits } from "@/lib/phone";
import { getBrowserClient } from "@/lib/supabase/client";

export { TILE };

export type MapShift = { id: string; name: string; startMin: number; endMin: number; isFullDay: boolean };
export type MapOccupant = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  phone: string;
  shiftId: string;
  startMin: number;
  endMin: number;
  endDate: string;
  hasDues: boolean;
};
export type MapSeat = { id: string; label: string; x: number; y: number; isActive: boolean; tags: string[]; occupants: MapOccupant[] };
export type MapZone = { id: string | null; name: string; girlsOnly: boolean; seats: MapSeat[] };

const EXPIRING_DAYS = 7;
const ALL = "all";
/** Smallest tile width at each zoom step (px). Step 0 fits the screen. */
const ZOOM = [30, 52, 68] as const;

function overlaps(o: { startMin: number; endMin: number }, range: [number, number]) {
  return o.startMin < range[1] && range[0] < o.endMin;
}

function stateFor(seat: MapSeat, range: [number, number] | null, today: string): { state: SeatState; who: MapOccupant[] } {
  if (!seat.isActive) return { state: "inactive", who: [] };
  const who = range ? seat.occupants.filter((o) => overlaps(o, range)) : seat.occupants;
  if (who.length === 0) return { state: "free", who };
  if (who.some((o) => o.hasDues)) return { state: "overdue", who };
  const soon = addDays(today, EXPIRING_DAYS);
  if (who.some((o) => o.endDate <= soon)) return { state: "expiring", who };
  return { state: "taken", who };
}

function heatClass(pct: number) {
  if (pct >= 80) return "bg-brand text-brand-fg border-transparent";
  if (pct >= 55) return "bg-brand/70 text-brand-fg border-transparent";
  if (pct >= 30) return "bg-brand/40 text-text border-transparent";
  if (pct > 0) return "bg-brand/15 text-text border-transparent";
  return "bg-surface text-text-3 border-dashed border-border-strong";
}

/** Live updates: when anyone changes a plan or seat, refresh the map. */
function useLiveSeats(libraryId: string) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  useEffect(() => {
    const supabase = getBrowserClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    (async () => {
      // Realtime checks the same security rules as everything else, so it
      // must connect as the logged-in person, not anonymously.
      const { data } = await supabase.auth.getSession();
      if (cancelled || !data.session) return;
      await supabase.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`seats-${libraryId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `library_id=eq.${libraryId}` }, () => {
          clearTimeout(timer);
          timer = setTimeout(() => router.refresh(), 400);
        })
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [libraryId, router]);
  return live;
}

export function SeatMap({
  zones,
  shifts,
  today,
  usage,
  libraryId,
}: {
  zones: MapZone[];
  shifts: MapShift[];
  today: string;
  usage: Record<string, number>;
  libraryId: string;
}) {
  const t = useTranslations("seats");
  const router = useRouter();
  const openAdmit = useAdmit();
  const live = useLiveSeats(libraryId);
  const [shiftId, setShiftId] = useState<string>(ALL);
  const [heat, setHeat] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [openSeat, setOpenSeat] = useState<string | null>(null);
  const [moving, setMoving] = useState<{ occupant: MapOccupant; fromSeat: MapSeat } | null>(null);
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  const [, start] = useTransition();
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const range = useMemo<[number, number] | null>(() => {
    if (moving) return [moving.occupant.startMin, moving.occupant.endMin];
    const s = shifts.find((x) => x.id === shiftId);
    return s ? [s.startMin, s.endMin] : null;
  }, [shiftId, shifts, moving]);
  const rangeKey = range ? range.join("-") : ALL;

  const computed = useMemo(
    () =>
      zones.map((z) => {
        const seats = z.seats.map((s) => ({ seat: s, ...stateFor(s, range, today) }));
        const open = seats.filter((s) => s.state !== "inactive");
        return { zone: z, seats, free: open.filter((s) => s.state === "free").length, total: open.length };
      }),
    [zones, range, today],
  );

  function pulse(ids: string[]) {
    if (ids.length === 0) return;
    setFlash(new Set(ids));
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(new Set()), 900);
  }

  // When a seat frees up or fills because of someone else's change, that
  // tile pulses once. Switching shift doesn't count as a change.
  const prev = useRef<{ key: string; states: Map<string, SeatState> } | null>(null);
  useEffect(() => {
    const states = new Map(computed.flatMap((z) => z.seats.map((s) => [s.seat.id, s.state] as const)));
    const before = prev.current;
    prev.current = { key: rangeKey, states };
    if (!before || before.key !== rangeKey) return;
    const changed = [...states].filter(([id, st]) => before.states.has(id) && before.states.get(id) !== st).map(([id]) => id);
    if (changed.length > 0 && changed.length <= 6) pulse(changed);
  }, [computed, rangeKey]);

  const allSeats = useMemo(() => zones.flatMap((z) => z.seats.map((s) => ({ ...s, zone: z }))), [zones]);
  const selected = allSeats.find((s) => s.id === openSeat) ?? null;

  function doMove(occupant: MapOccupant, to: MapSeat, from: MapSeat, isUndo = false) {
    start(async () => {
      const res = await moveSeat(occupant.subscriptionId, to.id);
      if (!res.ok) {
        navigator.vibrate?.(80);
        toast(res.error === "seatTaken" ? t("errTaken") : t("errFailed"), { tone: "error" });
        return;
      }
      pulse([to.id]);
      setMoving(null);
      router.refresh();
      if (!isUndo) {
        toast(t("moved", { name: occupant.studentName, label: to.label }), {
          action: { label: t("undo"), onClick: () => doMove(occupant, from, to, true) },
        });
      }
    });
  }

  function onTile(seat: MapSeat, state: SeatState) {
    if (moving) {
      if (state === "free") doMove(moving.occupant, seat, moving.fromSeat);
      return;
    }
    setOpenSeat(seat.id);
  }

  const minTile = ZOOM[zoom];

  return (
    <div>
      <Segmented
        label={t("shiftPicker")}
        value={moving ? (moving.occupant.shiftId ?? ALL) : shiftId}
        onChange={(v) => !moving && setShiftId(v)}
        options={[{ value: ALL, label: t("allShifts") }, ...shifts.map((s) => ({ value: s.id, label: s.name }))]}
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Button
          variant={heat ? "soft" : "secondary"}
          size="sm"
          aria-pressed={heat}
          onClick={() => setHeat(!heat)}
          disabled={Boolean(moving)}
          className="h-11"
        >
          <Flame aria-hidden />
          {t("heatmap")}
        </Button>
        <div className="flex items-center gap-2">
          {live ? (
            <span className="mr-1 flex items-center gap-1.5 text-sm font-medium text-success">
              <span className="size-2 rounded-full bg-success" aria-hidden />
              {t("live")}
            </span>
          ) : null}
          <div className="flex items-center rounded-[12px] border border-border-strong bg-surface" role="group" aria-label={t("zoom")}>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0, z - 1))}
              disabled={zoom === 0}
              className="grid size-11 place-items-center rounded-l-[11px] text-text-2 hover:bg-surface-hover disabled:opacity-35"
              aria-label={t("zoomOut")}
            >
              <Minus className="size-5" aria-hidden />
            </button>
            <span className="w-px self-stretch bg-border" aria-hidden />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(ZOOM.length - 1, z + 1))}
              disabled={zoom === ZOOM.length - 1}
              className="grid size-11 place-items-center rounded-r-[11px] text-text-2 hover:bg-surface-hover disabled:opacity-35"
              aria-label={t("zoomIn")}
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
      {heat ? <p className="mt-2 text-[15px] text-text-2">{t("heatmapHint")}</p> : <p className="mt-2 text-[15px] text-text-3">{t("tapHint")}</p>}

      {moving ? (
        <div className="sticky top-2 z-30 mt-3 flex items-center gap-3 rounded-[14px] bg-text px-4 py-3 text-bg shadow-[var(--shadow-pop)]" role="status">
          <ArrowRightLeft className="size-5 shrink-0" aria-hidden />
          <p className="flex-1 text-base font-medium">{t("moveBanner", { name: moving.occupant.studentName })}</p>
          <button type="button" onClick={() => setMoving(null)} className="flex h-11 items-center gap-1 rounded-[10px] px-2 font-semibold">
            <X className="size-5" aria-hidden />
            {t("cancelMove")}
          </button>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {computed.map(({ zone, seats, free, total }) => {
          const xs = seats.map((s) => s.seat.x);
          const cols = Math.max(...xs) + 1;
          const used = new Set(xs);
          const template = Array.from({ length: cols }, (_, i) => (used.has(i) ? `minmax(${minTile}px, 1fr)` : "10px")).join(" ");
          const maxTile = Math.max(56, minTile);
          return (
            <section
              key={zone.id ?? "none"}
              className="-mx-2 rounded-[20px] border border-border bg-surface p-3 shadow-sm sm:mx-0 sm:p-5"
              aria-label={zone.name || t("title")}
            >
              <header className="mb-4 flex items-center gap-3 px-1">
                {!heat ? (
                  <span className="relative grid place-items-center">
                    <MiniRing taken={total - free} total={total} />
                  </span>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-1.5 text-lg leading-tight font-semibold">
                    {zone.name || t("title")}
                    {zone.girlsOnly ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-2 px-2 py-0.5 text-sm font-medium text-text-2">
                        <Venus className="size-4" aria-hidden />
                        {t("girlsOnly")}
                      </span>
                    ) : null}
                  </h2>
                  {!heat ? (
                    <p className="text-[15px] text-text-2 tabular">
                      {t("freeCount", { count: free })} · {t("ofTotal", { total })}
                    </p>
                  ) : null}
                </div>
              </header>
              <div className="-mx-1 overflow-x-auto overscroll-x-contain px-1 pt-2 pb-1">
                <ul
                  key={rangeKey}
                  className="grid gap-1.5 sm:gap-2"
                  style={{ gridTemplateColumns: template, maxWidth: zoom === 0 ? used.size * maxTile + (cols - used.size) * 10 : undefined }}
                >
                  {seats.map(({ seat, state, who }) => {
                    const pct = usage[seat.id] ?? 0;
                    const disabled = Boolean(moving) && (state !== "free" || seat.id === moving?.fromSeat.id);
                    const delay = Math.min((seat.x + seat.y) * 14, 280);
                    return (
                      <li
                        key={seat.id}
                        className="seat-in [container-type:inline-size]"
                        style={{ gridColumnStart: seat.x + 1, gridRowStart: seat.y + 1, animationDelay: `${delay}ms` }}
                      >
                        {heat && seat.isActive ? (
                          <button
                            type="button"
                            onClick={() => onTile(seat, state)}
                            aria-label={`${t("seatLabel", { label: seat.label })}: ${pct}%`}
                            className={cn(
                              "flex aspect-square w-full flex-col items-center justify-center rounded-t-[8px] rounded-b-[14px] border-2 font-bold tabular leading-none",
                              heatClass(pct),
                            )}
                          >
                            <span className="text-[clamp(12px,28cqw,16px)]">{seat.label}</span>
                            <span className="mt-0.5 text-[clamp(10px,22cqw,13px)] font-semibold">{pct}%</span>
                          </button>
                        ) : (
                          <SeatTile
                            state={state}
                            label={seat.label}
                            initials={zoom > 0 && who[0] ? initials(who[0].studentName) : undefined}
                            more={range === null ? who.length - 1 : 0}
                            disabled={disabled}
                            onClick={() => onTile(seat, state)}
                            aria-label={
                              state === "free"
                                ? t("seatFreeA11y", { label: seat.label })
                                : who.length
                                  ? `${t("seatTakenBy", { label: seat.label, name: who.map((w) => w.studentName).join(", ") })}, ${t(state)}`
                                  : `${t("seatLabel", { label: seat.label })}, ${t(state)}`
                            }
                            className={cn(
                              moving && !disabled && "ring-2 ring-success ring-offset-2 ring-offset-surface",
                              disabled && "opacity-35",
                              flash.has(seat.id) && "seat-flash",
                            )}
                          />
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      {!heat ? (
        <section className="mt-5" aria-label={t("legend")}>
          <h2 className="mb-2 text-[15px] font-semibold text-text-2">{t("legend")}</h2>
          <ul className="flex flex-wrap gap-x-5 gap-y-3">
            {(["free", "taken", "expiring", "overdue", "inactive"] as const).map((s) => (
              <li key={s} className="flex items-center gap-2 text-[15px] text-text-2">
                <span className={cn("relative size-7 rounded-t-[5px] rounded-b-[9px]", TILE[s])} aria-hidden />
                {t(s)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <SeatSheet
        seat={selected}
        state={selected ? stateFor(selected, null, today).state : "free"}
        shifts={shifts}
        today={today}
        onClose={() => setOpenSeat(null)}
        onAdmit={(shift) => {
          setOpenSeat(null);
          openAdmit({ seatId: selected!.id, shiftId: shift?.id });
        }}
        onMove={(occupant) => {
          setOpenSeat(null);
          setHeat(false);
          setMoving({ occupant, fromSeat: selected! });
        }}
        onVacate={(occupant) => {
          const from = selected!;
          setOpenSeat(null);
          start(async () => {
            const res = await vacateSeat(occupant.subscriptionId);
            if (!res.ok) return void toast(t("errFailed"), { tone: "error" });
            router.refresh();
            toast(t("vacated", { label: from.label }), {
              action: { label: t("undo"), onClick: () => doMove(occupant, from, from, true) },
            });
          });
        }}
      />
    </div>
  );
}

function SeatSheet({
  seat,
  state,
  shifts,
  today,
  onClose,
  onAdmit,
  onMove,
  onVacate,
}: {
  seat: (MapSeat & { zone: MapZone }) | null;
  state: SeatState;
  shifts: MapShift[];
  today: string;
  onClose: () => void;
  onAdmit: (shift?: MapShift) => void;
  onMove: (o: MapOccupant) => void;
  onVacate: (o: MapOccupant) => void;
}) {
  const t = useTranslations("seats");
  const tc = useTranslations("admit");
  const locale = useLocale() as AppLocale;
  const soon = addDays(today, EXPIRING_DAYS);

  // Part-day shifts with nobody in them on this seat.
  const freeShifts = seat?.isActive
    ? shifts.filter((s) => !s.isFullDay && !seat.occupants.some((o) => overlaps(o, [s.startMin, s.endMin])))
    : [];
  const fullDayFree = seat?.isActive && seat.occupants.length === 0;
  const shiftName = (o: MapOccupant) => shifts.find((s) => s.id === o.shiftId)?.name ?? "";

  return (
    <Sheet
      open={seat !== null}
      onOpenChange={(o) => !o && onClose()}
      title={seat ? t("seatLabel", { label: seat.label }) : ""}
      description={seat?.zone.name || undefined}
      closeLabel={tc("close")}
    >
      {seat ? (
        <div className="space-y-4 pb-2">
          <SeatStateRow state={state} label={seat.label} />
          {!seat.isActive ? <p className="rounded-[12px] bg-surface-2 px-4 py-3 text-base text-text-2">{t("closed")}</p> : null}

          {seat.occupants.map((o) => (
            <div key={o.subscriptionId} className="rounded-[14px] border border-border p-4">
              <div className="flex items-center gap-3">
                <Avatar name={o.studentName} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{o.studentName}</p>
                  <p className="text-sm text-text-2 tabular">
                    {shiftName(o)} · {formatMinutesShort(o.startMin, locale)} – {formatMinutesShort(o.endMin, locale)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {o.hasDues ? <StatusPill status="overdue" label={t("owes")} /> : null}
                <StatusPill
                  status={o.endDate <= soon ? "expiring" : "paid"}
                  label={t("planTill", { date: formatDay(o.endDate, locale) })}
                />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <a href={`tel:${o.phone}`} className={buttonVariants({ variant: "secondary", className: "flex-col gap-0.5 h-16 text-sm" })}>
                  <Phone aria-hidden />
                  {t("call")}
                </a>
                <a
                  href={`https://wa.me/${phoneDigits(o.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "secondary", className: "flex-col gap-0.5 h-16 text-sm" })}
                >
                  <MessageCircle aria-hidden />
                  {t("whatsapp")}
                </a>
                <Link href={`/students/${o.studentId}`} className={buttonVariants({ variant: "secondary", className: "flex-col gap-0.5 h-16 text-sm" })}>
                  <UserRound aria-hidden />
                  {t("profile")}
                </Link>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="soft" onClick={() => onMove(o)}>
                  <ArrowRightLeft aria-hidden />
                  {t("move")}
                </Button>
                <Button variant="ghost" className="text-danger" onClick={() => onVacate(o)}>
                  {t("vacate")}
                </Button>
              </div>
            </div>
          ))}

          {fullDayFree ? (
            <Button size="lg" block onClick={() => onAdmit()}>
              <Plus aria-hidden />
              {t("admitHere")}
            </Button>
          ) : freeShifts.length > 0 ? (
            <div className="space-y-2">
              {freeShifts.map((s) => (
                <Button key={s.id} variant="soft" size="lg" block onClick={() => onAdmit(s)} className="justify-between">
                  <span>{t("freeIn", { shift: s.name })}</span>
                  <span className="flex items-center gap-1 text-base">
                    <Plus aria-hidden />
                    {t("admitHere")}
                  </span>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </Sheet>
  );
}

function SeatStateRow({ state, label }: { state: SeatState; label: string }) {
  const t = useTranslations("seats");
  const Icon = STATE_ICON[state];
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-surface-2 p-3">
      <span className={cn("grid size-12 shrink-0 place-items-center rounded-t-[7px] rounded-b-[12px] text-sm font-bold tabular", TILE[state])} aria-hidden>
        {label}
      </span>
      <p className="flex items-center gap-2 text-base font-semibold">
        <Icon className="size-5" aria-hidden />
        {t(state)}
      </p>
    </div>
  );
}

/**
 * Seat availability and the "best free seat" suggestion used when admitting.
 * The database's exclusion constraint is the final word on clashes; this
 * mirrors it so the UI only ever offers seats that will be accepted.
 */

export type Booking = { startMin: number; endMin: number; startDate: string; endDate: string };
export type SeatInfo = {
  id: string;
  label: string;
  zoneId: string | null;
  x: number;
  y: number;
  isActive: boolean;
  tags: string[];
  bookings: Booking[];
};
export type ZoneInfo = { id: string; girlsOnly: boolean };

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd; // half-open [start, end)
}

export function datesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd; // inclusive
}

export function isSeatFree(
  seat: SeatInfo,
  want: { startMin: number; endMin: number; startDate: string; endDate: string },
): boolean {
  if (!seat.isActive) return false;
  return !seat.bookings.some(
    (b) =>
      rangesOverlap(b.startMin, b.endMin, want.startMin, want.endMin) &&
      datesOverlap(b.startDate, b.endDate, want.startDate, want.endDate),
  );
}

export type SuggestInput = {
  seats: SeatInfo[];
  zones: ZoneInfo[];
  want: { startMin: number; endMin: number; startDate: string; endDate: string };
  gender?: "male" | "female" | "other" | null;
  previousSeatId?: string | null;
  nearSeatId?: string | null;
  preferredZoneId?: string | null;
};

/**
 * Free seats, best first:
 * 1. the seat they had before (renewals keep their seat)
 * 2. next to the friend who referred them
 * 3. the zone they asked for
 * 4. for part-day shifts, a seat already used in another shift — this keeps
 *    whole seats free for Full Day students
 * 5. window / charging point
 * 6. label order (A1, A2 … A10)
 * Girls-only zones are never suggested for male students.
 */
export function suggestSeats(input: SuggestInput): SeatInfo[] {
  const girlsOnly = new Set(input.zones.filter((z) => z.girlsOnly).map((z) => z.id));
  const near = input.nearSeatId ? input.seats.find((s) => s.id === input.nearSeatId) : undefined;
  const fullDay = input.want.endMin - input.want.startMin >= 10 * 60;
  const collator = new Intl.Collator("en", { numeric: true });

  const candidates = input.seats.filter(
    (s) =>
      isSeatFree(s, input.want) &&
      !(input.gender === "male" && s.zoneId !== null && girlsOnly.has(s.zoneId)),
  );

  const score = (s: SeatInfo): number => {
    let n = 0;
    if (s.id === input.previousSeatId) n += 10_000;
    if (near && s.zoneId === near.zoneId) {
      const d = Math.abs(s.x - near.x) + Math.abs(s.y - near.y);
      n += Math.max(0, 1_000 - d * 100);
    }
    if (input.preferredZoneId && s.zoneId === input.preferredZoneId) n += 500;
    if (input.gender === "female" && s.zoneId !== null && girlsOnly.has(s.zoneId)) n += 200;
    const sharedToday = s.bookings.some((b) => datesOverlap(b.startDate, b.endDate, input.want.startDate, input.want.endDate));
    if (!fullDay && sharedToday) n += 100;
    if (s.tags.includes("window")) n += 5;
    if (s.tags.includes("charging")) n += 3;
    return n;
  };

  return candidates
    .map((s) => ({ s, n: score(s) }))
    .sort((a, b) => b.n - a.n || collator.compare(a.s.label, b.s.label))
    .map(({ s }) => s);
}

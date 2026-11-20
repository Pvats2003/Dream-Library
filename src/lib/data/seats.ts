import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/dates";

export type SeatOccupant = {
  subscriptionId: string;
  studentId: string;
  studentName: string;
  shiftId: string;
  startMin: number;
  endMin: number;
  endDate: string;
  hasDues: boolean;
  status: "active" | "paused" | "upcoming";
};
export type SeatView = {
  id: string;
  label: string;
  x: number;
  y: number;
  isActive: boolean;
  tags: string[];
  occupants: SeatOccupant[];
};
export type ZoneView = { id: string | null; name: string; seats: SeatView[] };

function parseRange(r: string): [number, number] {
  // Postgres int4range text, e.g. "[360,720)".
  const m = /^[[(](\d+),(\d+)[)\]]$/.exec(r);
  return m ? [Number(m[1]), Number(m[2])] : [0, 0];
}

export async function getSeatBoard(libraryId: string, onDate: string): Promise<ZoneView[]> {
  const supabase = await createClient();
  const [zones, seats, subs, dues] = await Promise.all([
    supabase.from("zones").select("id, name, sort_order").eq("library_id", libraryId).order("sort_order"),
    supabase.from("seats").select("id, label, x, y, is_active, tags, zone_id").eq("library_id", libraryId),
    supabase
      .from("subscriptions")
      .select("id, seat_id, shift_id, shift_minutes, end_date, status, student:students!inner(id, name)")
      .eq("library_id", libraryId)
      .in("status", ["active", "paused", "upcoming"])
      .lte("start_date", onDate)
      .gte("end_date", onDate)
      .not("seat_id", "is", null),
    supabase
      .from("invoices")
      .select("student_id")
      .eq("library_id", libraryId)
      .in("status", ["due", "partial"])
      .lt("due_date", onDate),
  ]);
  for (const r of [zones, seats, subs, dues]) if (r.error) throw r.error;

  const owing = new Set(dues.data!.map((d) => d.student_id));
  const bySeat = new Map<string, SeatOccupant[]>();
  for (const s of subs.data!) {
    const [startMin, endMin] = parseRange(s.shift_minutes as unknown as string);
    const list = bySeat.get(s.seat_id!) ?? [];
    list.push({
      subscriptionId: s.id,
      studentId: s.student.id,
      studentName: s.student.name,
      shiftId: s.shift_id,
      startMin,
      endMin,
      endDate: s.end_date,
      hasDues: owing.has(s.student.id),
      status: s.status as SeatOccupant["status"],
    });
    bySeat.set(s.seat_id!, list);
  }

  const collator = new Intl.Collator("en", { numeric: true });
  const toView = (z: { id: string | null; name: string }): ZoneView => ({
    id: z.id,
    name: z.name,
    seats: seats
      .data!.filter((s) => s.zone_id === z.id)
      .map((s) => ({
        id: s.id,
        label: s.label,
        x: s.x,
        y: s.y,
        isActive: s.is_active,
        tags: s.tags,
        occupants: bySeat.get(s.id) ?? [],
      }))
      .sort((a, b) => a.y - b.y || a.x - b.x || collator.compare(a.label, b.label)),
  });

  const result = zones.data!.map(toView);
  if (seats.data!.some((s) => s.zone_id === null)) result.push(toView({ id: null, name: "" }));
  return result.filter((z) => z.seats.length > 0);
}

/** "Ending soon" means the plan ends within this many days. */
export const EXPIRING_DAYS = 7;
export function isEndingSoon(endDate: string, today: string) {
  return endDate <= addDays(today, EXPIRING_DAYS);
}

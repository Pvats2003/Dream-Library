import type { Metadata } from "next";
import { ShiftsStep, type ShiftDraft } from "@/components/features/setup/shifts-step";
import { minutesToHHMM } from "@/lib/dates";
import { requireSetupAccess } from "@/lib/data/setup";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shifts" };

// Sensible starting point for a Bihar reading room; every value is editable.
const DEFAULTS: Omit<ShiftDraft, "key">[] = [
  { id: null, name: "Morning", start: "06:00", end: "12:00", isFullDay: false },
  { id: null, name: "Evening", start: "12:00", end: "18:00", isFullDay: false },
  { id: null, name: "Night", start: "18:00", end: "23:00", isFullDay: false },
  { id: null, name: "Full Day", start: "06:00", end: "23:00", isFullDay: true },
];

export default async function ShiftsPage() {
  const { membership } = await requireSetupAccess();
  const supabase = await createClient();
  const { data } = await supabase
    .from("shifts")
    .select("id, name, start_min, end_min, is_full_day")
    .eq("library_id", membership.libraryId)
    .eq("is_active", true)
    .order("sort_order");
  const initial: ShiftDraft[] = data?.length
    ? data.map((s) => ({ id: s.id, key: s.id, name: s.name, start: minutesToHHMM(s.start_min), end: minutesToHHMM(s.end_min), isFullDay: s.is_full_day }))
    : DEFAULTS.map((d, i) => ({ ...d, key: `d${i}` }));
  return <ShiftsStep initial={initial} />;
}

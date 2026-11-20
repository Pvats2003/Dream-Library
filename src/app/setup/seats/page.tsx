import type { Metadata } from "next";
import { LayoutBuilder } from "@/components/features/setup/layout-builder";
import { requireSetupAccess } from "@/lib/data/setup";
import { draftFromSeats, type ZoneDraft } from "@/lib/layout";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Seats" };

const STARTER: ZoneDraft = {
  key: "starter",
  name: "Hall",
  rows: 5,
  cols: 8,
  aisleAfter: 4,
  labelStyle: "rows",
  prefix: "A",
  removed: [],
  girlsOnly: false,
  ac: true,
  cabin: false,
};

export default async function SeatsStep() {
  const { membership } = await requireSetupAccess();
  const supabase = await createClient();
  const [zones, seats] = await Promise.all([
    supabase.from("zones").select("id, name, attributes").eq("library_id", membership.libraryId).order("sort_order"),
    supabase.from("seats").select("label, x, y, zone_id").eq("library_id", membership.libraryId).eq("is_active", true),
  ]);
  const drafts = (zones.data ?? [])
    .map((z) =>
      draftFromSeats(
        z.id,
        z.name,
        (z.attributes ?? {}) as { ac?: boolean; girls_only?: boolean; cabin?: boolean },
        (seats.data ?? []).filter((s) => s.zone_id === z.id),
      ),
    )
    .filter((d) => d.rows > 0);
  return <LayoutBuilder initial={drafts.length ? drafts : [STARTER]} nextHref="/setup/shifts" />;
}

import { Armchair } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SeatMap } from "@/components/features/seats/seat-map";
import { EmptyState } from "@/components/patterns/empty-state";
import { PageHeader } from "@/components/patterns/page-header";
import { getShifts, libraryToday } from "@/lib/data/library";
import { getSeatBoard } from "@/lib/data/seats";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Seats" };

export default async function SeatsPage() {
  const { membership } = await requireLibrary();
  const today = await libraryToday(membership.libraryId);
  const [zones, shifts, t] = await Promise.all([
    getSeatBoard(membership.libraryId, today),
    getShifts(membership.libraryId),
    getTranslations("seats"),
  ]);
  const free = zones.flatMap((z) => z.seats).filter((s) => s.isActive && s.occupants.length === 0).length;

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("freeCount", { count: free })} />
      {zones.length === 0 ? (
        <EmptyState icon={Armchair} title={t("noSeats")} />
      ) : (
        <SeatMap zones={zones} shifts={shifts} today={today} />
      )}
    </div>
  );
}

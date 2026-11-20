import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PlansStep, type PlanDraft } from "@/components/features/setup/plans-step";
import { requireSetupAccess } from "@/lib/data/setup";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fees" };

export default async function PlansPage() {
  const { membership } = await requireSetupAccess();
  const supabase = await createClient();
  const [shifts, plans] = await Promise.all([
    supabase.from("shifts").select("id, name, is_full_day").eq("library_id", membership.libraryId).eq("is_active", true).order("sort_order"),
    supabase.from("plans").select("id, name, shift_id, duration_months, price_paise").eq("library_id", membership.libraryId).eq("is_active", true).order("sort_order"),
  ]);
  if (!shifts.data?.length) redirect("/setup/shifts");
  const initial: PlanDraft[] = plans.data?.length
    ? plans.data.map((p) => ({ id: p.id, key: p.id, name: p.name, shiftId: p.shift_id, months: p.duration_months ?? 1, pricePaise: p.price_paise }))
    : // One monthly plan per shift to start with; prices are placeholders the owner edits.
      shifts.data.map((s) => ({ id: null, key: s.id, name: "", shiftId: s.id, months: 1, pricePaise: s.is_full_day ? 120000 : 60000 }));
  return <PlansStep initial={initial} shifts={shifts.data.map((s) => ({ id: s.id, name: s.name }))} />;
}

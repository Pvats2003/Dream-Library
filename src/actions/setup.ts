"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeIndianMobile } from "@/lib/phone";
import { ACTIVE_LIBRARY_COOKIE, requireLibrary, requireViewer } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type SetupResult = { ok: true; warning?: "inUse" } | { ok: false; error: "invalid" | "noPermission" | "failed" | "exists" };

async function requireSettings() {
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_edit_settings) throw new Error("NO_PERMISSION");
  return membership;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

export async function createLibrary(input: { name: string; city: string; ownerName: string }): Promise<{ ok: true } | { ok: false; error: "invalid" | "failed" }> {
  const v = z
    .object({ name: z.string().trim().min(1).max(120), city: z.string().trim().max(120), ownerName: z.string().trim().max(120) })
    .safeParse(input);
  if (!v.success) return { ok: false, error: "invalid" };
  await requireViewer();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_library", { lib_name: v.data.name, lib_city: v.data.city, owner_name: v.data.ownerName });
  if (error || !data) return { ok: false, error: "failed" };
  (await cookies()).set(ACTIVE_LIBRARY_COOKIE, data, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  refreshAll();
  return { ok: true };
}

const layoutSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1).max(60),
      attributes: z.object({ ac: z.boolean(), girls_only: z.boolean(), cabin: z.boolean() }),
      seats: z.array(z.object({ label: z.string().min(1).max(12), x: z.number().int().min(0).max(60), y: z.number().int().min(0).max(60) })).max(600),
    }),
  )
  .max(20);

export async function saveLayout(zones: z.input<typeof layoutSchema>): Promise<SetupResult> {
  const v = layoutSchema.safeParse(zones);
  if (!v.success) return { ok: false, error: "invalid" };
  const labels = v.data.flatMap((z) => z.seats.map((s) => s.label));
  if (new Set(labels).size !== labels.length) return { ok: false, error: "invalid" };
  const membership = await requireSettings().catch(() => null);
  if (!membership) return { ok: false, error: "noPermission" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_layout", { lib: membership.libraryId, layout: v.data });
  if (error) {
    console.error("save_layout", error);
    return { ok: false, error: "failed" };
  }
  refreshAll();
  return { ok: true };
}

const shiftsSchema = z
  .array(
    z
      .object({
        id: z.uuid().nullable(),
        name: z.string().trim().min(1).max(40),
        startMin: z.number().int().min(0).max(1439),
        endMin: z.number().int().min(1).max(1440),
        isFullDay: z.boolean(),
      })
      .refine((s) => s.endMin > s.startMin),
  )
  .min(1)
  .max(12);

/** Upsert shifts; ones removed are deleted, or turned off if plans use them. */
export async function saveShifts(shifts: z.input<typeof shiftsSchema>): Promise<SetupResult> {
  const v = shiftsSchema.safeParse(shifts);
  if (!v.success) return { ok: false, error: "invalid" };
  const membership = await requireSettings().catch(() => null);
  if (!membership) return { ok: false, error: "noPermission" };
  const lib = membership.libraryId;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("shifts").select("id").eq("library_id", lib);
  const keep = new Set(v.data.map((s) => s.id).filter(Boolean));
  let inUse = false;
  for (const old of existing ?? []) {
    if (keep.has(old.id)) continue;
    const { error } = await supabase.from("shifts").delete().eq("id", old.id);
    if (error) {
      inUse = true;
      await supabase.from("shifts").update({ is_active: false, name: `${old.id.slice(0, 4)}-old` }).eq("id", old.id);
    }
  }
  for (const [i, s] of v.data.entries()) {
    const row = { library_id: lib, name: s.name, start_min: s.startMin, end_min: s.endMin, is_full_day: s.isFullDay, sort_order: i + 1, is_active: true };
    const { error } = s.id ? await supabase.from("shifts").update(row).eq("id", s.id) : await supabase.from("shifts").insert(row);
    if (error) {
      console.error("save shift", error);
      return { ok: false, error: error.code === "23505" ? "exists" : "failed" };
    }
  }
  refreshAll();
  return inUse ? { ok: true, warning: "inUse" } : { ok: true };
}

const plansSchema = z
  .array(
    z.object({
      id: z.uuid().nullable(),
      name: z.string().trim().min(1).max(60),
      shiftId: z.uuid(),
      months: z.number().int().min(1).max(24),
      pricePaise: z.number().int().min(0).max(10_000_000),
    }),
  )
  .max(30);

export async function savePlans(plans: z.input<typeof plansSchema>): Promise<SetupResult> {
  const v = plansSchema.safeParse(plans);
  if (!v.success) return { ok: false, error: "invalid" };
  const membership = await requireSettings().catch(() => null);
  if (!membership) return { ok: false, error: "noPermission" };
  const lib = membership.libraryId;
  const supabase = await createClient();
  const { data: existing } = await supabase.from("plans").select("id").eq("library_id", lib);
  const keep = new Set(v.data.map((p) => p.id).filter(Boolean));
  let inUse = false;
  for (const old of existing ?? []) {
    if (keep.has(old.id)) continue;
    const { error } = await supabase.from("plans").delete().eq("id", old.id);
    if (error) {
      inUse = true;
      await supabase.from("plans").update({ is_active: false, name: `${old.id.slice(0, 4)}-old` }).eq("id", old.id);
    }
  }
  for (const [i, p] of v.data.entries()) {
    const row = { library_id: lib, name: p.name, shift_id: p.shiftId, duration_months: p.months, duration_days: null, price_paise: p.pricePaise, sort_order: i + 1, is_active: true };
    const { error } = p.id ? await supabase.from("plans").update(row).eq("id", p.id) : await supabase.from("plans").insert(row);
    if (error) {
      console.error("save plan", error);
      return { ok: false, error: error.code === "23505" ? "exists" : "failed" };
    }
  }
  refreshAll();
  return inUse ? { ok: true, warning: "inUse" } : { ok: true };
}

export async function savePaymentDetails(input: { upiId: string; whatsapp: string; depositPaise: number }): Promise<SetupResult> {
  const v = z
    .object({
      upiId: z.string().trim().max(256).refine((u) => u === "" || /^[A-Za-z0-9._-]{2,200}@[A-Za-z]{2,64}$/.test(u)),
      whatsapp: z.string().trim(),
      depositPaise: z.number().int().min(0).max(10_000_000),
    })
    .safeParse(input);
  if (!v.success) return { ok: false, error: "invalid" };
  const wa = v.data.whatsapp ? normalizeIndianMobile(v.data.whatsapp) : null;
  if (v.data.whatsapp && !wa) return { ok: false, error: "invalid" };
  const membership = await requireSettings().catch(() => null);
  if (!membership) return { ok: false, error: "noPermission" };
  const supabase = await createClient();
  const { data: lib } = await supabase.from("libraries").select("settings").eq("id", membership.libraryId).single();
  const settings = { ...((lib?.settings as Record<string, unknown>) ?? {}), deposit_paise: v.data.depositPaise };
  const { error } = await supabase
    .from("libraries")
    .update({ upi_id: v.data.upiId || null, whatsapp_number: wa, settings })
    .eq("id", membership.libraryId);
  if (error) return { ok: false, error: "failed" };
  refreshAll();
  return { ok: true };
}

export async function addStaff(input: { name: string; phone: string; kind: "manager" | "desk"; canSeeEarnings: boolean }): Promise<SetupResult> {
  const v = z
    .object({ name: z.string().trim().min(1).max(80), phone: z.string(), kind: z.enum(["manager", "desk"]), canSeeEarnings: z.boolean() })
    .safeParse(input);
  const phone = v.success ? normalizeIndianMobile(v.data.phone) : null;
  if (!v.success || !phone) return { ok: false, error: "invalid" };
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_manage_staff) return { ok: false, error: "noPermission" };
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").insert({
    library_id: membership.libraryId,
    phone,
    display_name: v.data.name,
    role: v.data.kind,
    permissions: { can_see_earnings: v.data.canSeeEarnings },
  });
  if (error) return { ok: false, error: error.code === "23505" ? "exists" : "failed" };
  revalidatePath("/setup/staff");
  return { ok: true };
}

export async function removeStaff(membershipId: string): Promise<SetupResult> {
  const id = z.uuid().safeParse(membershipId);
  if (!id.success) return { ok: false, error: "invalid" };
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_manage_staff || id.data === membership.membershipId) return { ok: false, error: "noPermission" };
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("id", id.data).eq("library_id", membership.libraryId).neq("role", "owner");
  if (error) return { ok: false, error: "failed" };
  revalidatePath("/setup/staff");
  return { ok: true };
}

export async function finishSetup(): Promise<SetupResult> {
  const membership = await requireSettings().catch(() => null);
  if (!membership) return { ok: false, error: "noPermission" };
  const supabase = await createClient();
  const { error } = await supabase.from("libraries").update({ setup_completed_at: new Date().toISOString() }).eq("id", membership.libraryId);
  if (error) return { ok: false, error: "failed" };
  refreshAll();
  return { ok: true };
}

"use server";

import { z } from "zod";
import { normalizeIndianMobile } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";

export type JoinResult = { ok: true } | { ok: false; error: "invalidPhone" | "nameRequired" | "tooMany" | "badLink" | "failed" };

const schema = z.object({
  code: z.string().trim().min(4).max(40),
  name: z.string().trim().max(80),
  phone: z.string(),
  gender: z.enum(["male", "female", "other"]).nullable(),
  shiftId: z.uuid().nullable(),
  seatLabel: z.string().trim().max(12),
  lastPaidOn: z.union([z.iso.date(), z.literal("")]),
  examTarget: z.string().trim().max(60),
});

/** Public: a student sends their own details. No login needed. */
export async function submitJoin(input: z.input<typeof schema>): Promise<JoinResult> {
  const v = schema.safeParse(input);
  if (!v.success) return { ok: false, error: "failed" };
  if (!v.data.name) return { ok: false, error: "nameRequired" };
  const phone = normalizeIndianMobile(v.data.phone);
  if (!phone) return { ok: false, error: "invalidPhone" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_join_request", {
    code: v.data.code,
    input: {
      name: v.data.name,
      phone,
      gender: v.data.gender,
      shift_id: v.data.shiftId,
      seat_label: v.data.seatLabel,
      last_paid_on: v.data.lastPaidOn,
      exam_target: v.data.examTarget,
    },
  });
  if (error) {
    if (error.message.includes("TOO_MANY")) return { ok: false, error: "tooMany" };
    if (error.message.includes("BAD_LINK")) return { ok: false, error: "badLink" };
    if (error.message.includes("INVALID")) return { ok: false, error: "invalidPhone" };
    console.error("submit_join_request", error);
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

/** Staff: make a new join link (old QR posters stop working). */
export async function resetJoinLink(): Promise<{ ok: boolean }> {
  const { requireLibrary } = await import("@/lib/session");
  const { revalidatePath } = await import("next/cache");
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_edit_settings) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reset_join_code", { lib: membership.libraryId });
  if (error) return { ok: false };
  revalidatePath("/more/join");
  return { ok: true };
}

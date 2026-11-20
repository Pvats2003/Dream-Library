"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLibrary } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export type SeatActionResult = { ok: true } | { ok: false; error: "seatTaken" | "failed" };

function refresh() {
  for (const p of ["/seats", "/today", "/students"]) revalidatePath(p);
}

export async function moveSeat(subscriptionId: string, seatId: string): Promise<SeatActionResult> {
  const ids = z.object({ sub: z.uuid(), seat: z.uuid() }).safeParse({ sub: subscriptionId, seat: seatId });
  if (!ids.success) return { ok: false, error: "failed" };
  await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase.rpc("move_seat", { sub: ids.data.sub, new_seat: ids.data.seat });
  if (error) return { ok: false, error: error.code === "23P01" || error.message.includes("SEAT_NOT_AVAILABLE") ? "seatTaken" : "failed" };
  refresh();
  return { ok: true };
}

export async function vacateSeat(subscriptionId: string): Promise<SeatActionResult> {
  const sub = z.uuid().safeParse(subscriptionId);
  if (!sub.success) return { ok: false, error: "failed" };
  await requireLibrary();
  const supabase = await createClient();
  const { error } = await supabase.rpc("vacate_seat", { sub: sub.data });
  if (error) return { ok: false, error: "failed" };
  refresh();
  return { ok: true };
}

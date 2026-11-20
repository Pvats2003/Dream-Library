import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type ShiftInfo = { id: string; name: string; startMin: number; endMin: number; isFullDay: boolean };

export const getShifts = cache(async (libraryId: string): Promise<ShiftInfo[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shifts")
    .select("id, name, start_min, end_min, is_full_day")
    .eq("library_id", libraryId)
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return data.map((s) => ({ id: s.id, name: s.name, startMin: s.start_min, endMin: s.end_min, isFullDay: s.is_full_day }));
});

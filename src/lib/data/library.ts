import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { todayInTz } from "@/lib/dates";

export type LibraryInfo = {
  id: string;
  name: string;
  city: string | null;
  timezone: string;
  brandColor: string;
  upiId: string | null;
  whatsappNumber: string | null;
};

export const getLibrary = cache(async (libraryId: string): Promise<LibraryInfo> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("libraries")
    .select("id, name, city, timezone, brand_color, upi_id, whatsapp_number")
    .eq("id", libraryId)
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    city: data.city,
    timezone: data.timezone,
    brandColor: data.brand_color,
    upiId: data.upi_id,
    whatsappNumber: data.whatsapp_number,
  };
});

export async function libraryToday(libraryId: string) {
  const lib = await getLibrary(libraryId);
  return todayInTz(lib.timezone);
}

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

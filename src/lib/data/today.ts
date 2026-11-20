import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TodaySummary = {
  can_see_money: boolean;
  collected_today: number | null;
  payments_today: number;
  overdue_paise: number | null;
  overdue_students: number;
  due_week_paise: number | null;
  due_week_students: number;
  ending_week: number;
  in_library_now: number;
  active_students: number;
  seats: { shift_id: string; name: string; free: number; total: number; full_day: boolean }[];
};

export async function getTodaySummary(libraryId: string, onDate: string): Promise<TodaySummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("today_summary", { lib: libraryId, on_date: onDate });
  if (error) throw error;
  return data as unknown as TodaySummary;
}

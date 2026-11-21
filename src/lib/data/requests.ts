import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function countPendingRequests(libraryId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("join_requests")
    .select("id", { count: "exact", head: true })
    .eq("library_id", libraryId)
    .eq("status", "pending");
  return count ?? 0;
}

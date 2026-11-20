import type { Metadata } from "next";
import { StaffStep } from "@/components/features/setup/staff-step";
import { requireSetupAccess } from "@/lib/data/setup";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const { membership } = await requireSetupAccess();
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("id, display_name, phone, role, user_id")
    .eq("library_id", membership.libraryId)
    .eq("is_active", true)
    .order("created_at");
  return (
    <StaffStep
      staff={(data ?? []).map((m) => ({
        id: m.id,
        name: m.display_name,
        phone: m.phone,
        role: m.role,
        linked: m.user_id !== null,
        isMe: m.id === membership.membershipId,
      }))}
    />
  );
}

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export const ACTIVE_LIBRARY_COOKIE = "lib";

export type Role = Database["public"]["Enums"]["member_role"];
export type Permissions = {
  can_see_earnings: boolean;
  can_discount: boolean;
  can_delete: boolean;
  can_edit_settings: boolean;
  can_manage_staff: boolean;
};
export type Membership = {
  membershipId: string;
  libraryId: string;
  libraryName: string;
  librarySlug: string;
  role: Role;
  permissions: Permissions;
  setupCompleted: boolean;
};
export type Viewer = {
  userId: string;
  phone: string | null;
  fullName: string | null;
  isPlatformAdmin: boolean;
  memberships: Membership[];
};

/**
 * The logged-in person and the libraries they work in. Deduplicated per
 * request. Identity comes from a verified JWT (getClaims), never from an
 * unverified cookie.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone, is_platform_admin").eq("id", sub).maybeSingle(),
    supabase.rpc("my_memberships"),
  ]);

  return {
    userId: sub,
    phone: profile?.phone ?? (data.claims.phone ? `+${String(data.claims.phone).replace(/^\+/, "")}` : null),
    fullName: profile?.full_name ?? null,
    isPlatformAdmin: profile?.is_platform_admin ?? false,
    memberships: (rows ?? []).map((r) => ({
      membershipId: r.membership_id,
      libraryId: r.library_id,
      libraryName: r.library_name,
      librarySlug: r.library_slug,
      role: r.role,
      permissions: r.permissions as unknown as Permissions,
      setupCompleted: r.setup_completed,
    })),
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/welcome");
  return viewer;
}

/** The viewer plus the library they're working in right now. */
export const requireLibrary = cache(async (): Promise<{ viewer: Viewer; membership: Membership }> => {
  const viewer = await requireViewer();
  if (viewer.memberships.length === 0) redirect("/no-library");
  const chosen = (await cookies()).get(ACTIVE_LIBRARY_COOKIE)?.value;
  const membership = viewer.memberships.find((m) => m.libraryId === chosen) ?? viewer.memberships[0];
  return { viewer, membership };
});

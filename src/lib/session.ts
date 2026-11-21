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
  /** What the library calls this person, e.g. "Rajesh". */
  displayName: string;
  librarySlug: string;
  city: string | null;
  timezone: string;
  role: Role;
  permissions: Permissions;
  setupCompleted: boolean;
};
export type Viewer = {
  userId: string;
  phone: string | null;
  memberships: Membership[];
};

const OWNER_PERMISSIONS: Permissions = {
  can_see_earnings: true,
  can_discount: true,
  can_delete: true,
  can_edit_settings: true,
  can_manage_staff: true,
};

/**
 * The logged-in person and the libraries they work in, in ONE database
 * round trip (memberships with their library embedded). Deduplicated per
 * request. Identity comes from a verified JWT (getClaims verifies the ES256
 * signature locally, no network call), never from an unverified cookie.
 * The database enforces every permission again via RLS; these flags only
 * shape the UI.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (!sub) return null;

  const { data: rows } = await supabase
    .from("memberships")
    .select("id, role, permissions, display_name, library:libraries!inner(id, name, slug, city, timezone, setup_completed_at)")
    .eq("user_id", sub)
    .eq("is_active", true)
    .order("created_at");

  const phone = data.claims.phone ? `+${String(data.claims.phone).replace(/^\+/, "")}` : null;
  return {
    userId: sub,
    phone,
    memberships: (rows ?? []).map((r) => ({
      membershipId: r.id,
      libraryId: r.library.id,
      libraryName: r.library.name,
      displayName: r.display_name,
      librarySlug: r.library.slug,
      city: r.library.city,
      timezone: r.library.timezone,
      role: r.role,
      permissions: r.role === "owner" ? OWNER_PERMISSIONS : (r.permissions as unknown as Permissions),
      setupCompleted: r.library.setup_completed_at !== null,
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

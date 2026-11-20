import "server-only";
import { redirect } from "next/navigation";
import { requireLibrary } from "@/lib/session";

/** Only people who can change settings may use the setup wizard. */
export async function requireSetupAccess() {
  const ctx = await requireLibrary();
  if (!ctx.membership.permissions.can_edit_settings) redirect("/today");
  return ctx;
}

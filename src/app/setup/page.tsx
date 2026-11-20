import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LibraryStep } from "@/components/features/setup/library-step";
import { requireViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Setup" };

export default async function SetupStart() {
  const viewer = await requireViewer();
  // Already has a library: carry on with its setup.
  if (viewer.memberships.some((m) => m.permissions.can_edit_settings)) redirect("/setup/seats");
  return <LibraryStep />;
}

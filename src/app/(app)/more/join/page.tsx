import type { Metadata } from "next";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { JoinShare } from "@/components/features/join/join-share";
import { requireLibrary } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "QR" };

export default async function JoinSharePage() {
  const { membership } = await requireLibrary();
  const supabase = await createClient();
  const [{ data }, { count }, h] = await Promise.all([
    supabase.from("libraries").select("join_code").eq("id", membership.libraryId).single(),
    supabase.from("join_requests").select("id", { count: "exact", head: true }).eq("library_id", membership.libraryId).eq("status", "pending"),
    headers(),
  ]);
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/join/${data?.join_code ?? ""}`;
  const svg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1a1a2e", light: "#ffffff" } });
  return (
    <JoinShare
      link={link}
      qrSvg={svg}
      libraryName={membership.libraryName}
      pending={count ?? 0}
      canReset={membership.permissions.can_edit_settings}
    />
  );
}

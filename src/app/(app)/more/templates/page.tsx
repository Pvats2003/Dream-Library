import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TemplatesEditor } from "@/components/features/money/templates-editor";
import { getTemplates } from "@/lib/data/fees";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function TemplatesPage() {
  const { membership } = await requireLibrary();
  if (!membership.permissions.can_edit_settings) redirect("/more");
  const [hi, en] = await Promise.all([getTemplates(membership.libraryId, "hi"), getTemplates(membership.libraryId, "en")]);
  return <TemplatesEditor initial={{ hi, en }} libraryName={membership.libraryName} />;
}

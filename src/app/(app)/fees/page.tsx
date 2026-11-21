import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { FeesInbox } from "@/components/features/money/fees-inbox";
import { getEndingSoon, getLibraryPayInfo, getOpenInvoices, getTemplates } from "@/lib/data/fees";
import { todayInTz } from "@/lib/dates";
import { requireLibrary } from "@/lib/session";

export const metadata: Metadata = { title: "Fees" };

export default async function FeesPage() {
  const { membership } = await requireLibrary();
  const today = todayInTz(membership.timezone);
  const locale = (await getLocale()) as "hi" | "en";
  const [{ invoices, snoozed }, ending, templates, lib] = await Promise.all([
    getOpenInvoices(membership.libraryId, today),
    getEndingSoon(membership.libraryId, today),
    getTemplates(membership.libraryId, locale),
    getLibraryPayInfo(membership.libraryId),
  ]);
  return (
    <FeesInbox
      invoices={invoices}
      ending={ending}
      snoozed={snoozed}
      today={today}
      templates={templates}
      libraryName={lib.name}
      upiId={lib.upiId}
      showTotal={membership.permissions.can_see_earnings}
    />
  );
}

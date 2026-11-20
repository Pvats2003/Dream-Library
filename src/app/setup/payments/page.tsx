import type { Metadata } from "next";
import { PaymentsStep } from "@/components/features/setup/payments-step";
import { requireSetupAccess } from "@/lib/data/setup";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const { membership } = await requireSetupAccess();
  const supabase = await createClient();
  const { data } = await supabase.from("libraries").select("upi_id, whatsapp_number, settings").eq("id", membership.libraryId).single();
  const settings = (data?.settings ?? {}) as { deposit_paise?: number };
  return (
    <PaymentsStep
      initial={{
        upiId: data?.upi_id ?? "",
        whatsapp: data?.whatsapp_number?.replace(/^\+91/, "") ?? "",
        depositPaise: settings.deposit_paise ?? 50000,
      }}
    />
  );
}

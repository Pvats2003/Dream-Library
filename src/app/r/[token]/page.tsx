import { FileX } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ReceiptView, type ReceiptData } from "@/components/features/money/receipt-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Receipt", robots: { index: false, follow: false } };

export default async function ReceiptPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_receipt", { token });
  const locale = (await getLocale()) as "hi" | "en";
  if (!data) {
    const t = await getTranslations("receipt");
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 grid size-14 place-items-center rounded-full bg-surface-2 text-text-3">
          <FileX className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">{t("notFound")}</h1>
        <p className="mt-2 text-base text-text-2">{t("notFoundBody")}</p>
      </main>
    );
  }
  return <ReceiptView r={data as unknown as ReceiptData} locale={locale} />;
}

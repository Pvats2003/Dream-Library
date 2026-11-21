"use client";

import { Printer, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { dateInTz, formatDay, type AppLocale } from "@/lib/dates";
import { amountInWords, formatINR } from "@/lib/money";

export type ReceiptData = {
  library_name: string;
  city: string | null;
  address: string | null;
  whatsapp_number: string | null;
  receipt_number: string;
  amount_paise: number;
  method: "cash" | "upi" | "card" | "bank";
  reference: string | null;
  received_at: string;
  timezone: string;
  student_name: string;
  phone_last4: string;
  plan_name: string | null;
  period_start: string | null;
  period_end: string | null;
  seat_label: string | null;
  invoice_due_paise: number;
  invoice_paid_paise: number;
  received_by: string | null;
  reversed: boolean;
};

/**
 * A receipt a student can keep: shared as a photo (the phone's browser
 * draws it, so Hindi renders correctly) or saved as PDF via print.
 */
export function ReceiptView({ r, locale }: { r: ReceiptData; locale: AppLocale }) {
  const t = useTranslations("receipt");
  const ta = useTranslations("admit");
  const card = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const day = dateInTz(new Date(r.received_at), r.timezone);
  const time = new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
    timeZone: r.timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(r.received_at));
  const owed = r.invoice_due_paise - r.invoice_paid_paise;

  async function sharePhoto() {
    if (!card.current) return;
    setBusy(true);
    try {
      const { toBlob } = await import("html-to-image");
      const blob = await toBlob(card.current, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
      if (!blob) return;
      const file = new File([blob], `${r.receipt_number}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: t("title") });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } catch {
      // Person closed the share sheet: nothing to do.
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-dvh bg-bg px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-md">
        <div ref={card} className="receipt relative overflow-hidden rounded-[18px] border border-[#e4e2dc] bg-white p-6 text-[#1a1a2e] print:border-0">
          {r.reversed ? (
            <div className="absolute top-24 right-[-60px] rotate-[20deg] border-4 border-[#c0392b] px-16 py-1 text-xl font-bold text-[#c0392b] opacity-80">
              {t("reversed")}
            </div>
          ) : null}
          <header className="border-b border-dashed border-[#d6d3cc] pb-4 text-center">
            <p className="text-xl font-bold">{r.library_name}</p>
            {r.address || r.city ? <p className="text-sm text-[#5b5b6b]">{[r.address, r.city].filter(Boolean).join(", ")}</p> : null}
            {r.whatsapp_number ? <p className="text-sm text-[#5b5b6b] tabular">WhatsApp: {r.whatsapp_number.replace(/^\+91/, "+91 ")}</p> : null}
            <p className="mt-3 text-base font-semibold tracking-wide text-[#3b3fb6]">{t("title")}</p>
            <p className="text-sm text-[#5b5b6b] tabular">{t("number", { number: r.receipt_number })}</p>
          </header>

          <dl className="divide-y divide-[#efede8] py-2">
            <Row label={t("date")} value={`${formatDay(day, locale, { year: true })}, ${time}`} />
            <Row label={t("student")} value={`${r.student_name} (••••${r.phone_last4})`} />
            {r.plan_name ? <Row label={t("plan")} value={r.plan_name} /> : null}
            {r.period_start && r.period_end ? (
              <Row label={t("period")} value={`${formatDay(r.period_start, locale)} – ${formatDay(r.period_end, locale, { year: true })}`} />
            ) : null}
            {r.seat_label ? <Row label={t("seat")} value={r.seat_label} /> : null}
            <Row label={t("method")} value={ta(r.method)} />
            {r.reference ? <Row label={t("reference")} value={<span className="tabular">{r.reference}</span>} /> : null}
            {r.received_by ? <Row label={t("receivedBy")} value={r.received_by} /> : null}
          </dl>

          <div className="mt-2 rounded-[14px] bg-[#f3f2fb] p-4 text-center">
            <p className="text-sm text-[#5b5b6b]">{t("amount")}</p>
            <p className="text-[36px] leading-tight font-bold tabular">{formatINR(r.amount_paise)}</p>
            <p className="mt-1 text-sm text-[#3d3d4e]">{amountInWords(r.amount_paise, locale)}</p>
          </div>

          <p className={`mt-4 text-center text-[15px] font-semibold ${owed > 0 ? "text-[#a6630c]" : "text-[#1e7a46]"}`}>
            {owed > 0 ? t("stillOwed", { amount: formatINR(owed) }) : t("fullyPaid")}
          </p>
          <p className="mt-4 border-t border-dashed border-[#d6d3cc] pt-3 text-center text-sm text-[#5b5b6b]">{t("thanks")}</p>
          <p className="mt-1 text-center text-[11px] text-[#9a99a6]">{t("generated")}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
          <Button size="lg" onClick={sharePhoto} disabled={busy}>
            <Share2 aria-hidden />
            {t("sharePhoto")}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden />
            {t("print")}
          </Button>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-[15px] text-[#5b5b6b]">{label}</dt>
      <dd className="text-right text-[15px] font-semibold">{value}</dd>
    </div>
  );
}

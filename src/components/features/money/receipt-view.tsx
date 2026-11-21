"use client";

import { CircleCheck, Clock, Printer, Share2 } from "lucide-react";
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
  shift_name?: string | null;
  brand_color?: string | null;
  invoice_due_paise: number;
  invoice_paid_paise: number;
  received_by: string | null;
  reversed: boolean;
};

/**
 * A receipt a student can keep: shared as a photo (the phone's browser
 * draws it, so Hindi renders correctly) or saved as PDF via print.
 */
/** White or ink text, whichever reads better on the library's colour. */
function inkOn(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return (1.05 / (L + 0.05)) >= 4.5 ? "#ffffff" : "#16162a";
}

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

  const brand = r.brand_color && /^#[0-9a-f]{6}$/i.test(r.brand_color) ? r.brand_color : "#3b3fb6";
  const ink = inkOn(brand);
  const monogram = r.library_name.trim().charAt(0).toUpperCase();
  const seatShift = [r.seat_label ? t("seatValue", { label: r.seat_label }) : null, r.shift_name].filter(Boolean).join(" · ");

  return (
    <main className="min-h-dvh bg-bg px-4 py-6 print:bg-white print:p-0">
      <div className="mx-auto max-w-md">
        {/* Fixed paper colours on purpose: the receipt is shared as a photo and must look the same everywhere. */}
        <div
          ref={card}
          className="receipt relative overflow-hidden rounded-[20px] bg-[#fffdf8] text-[#16162a] shadow-[0_10px_40px_-12px_rgb(20_20_50/0.25)] print:shadow-none"
          style={{ ["--rb" as string]: brand }}
        >
          {r.reversed ? (
            <div className="absolute top-40 right-[-64px] z-10 rotate-[20deg] border-4 border-[#b3261e] bg-[#fffdf8]/80 px-16 py-1 text-xl font-bold text-[#b3261e]">
              {t("reversed")}
            </div>
          ) : null}

          <header className="relative px-6 pt-6 pb-7" style={{ background: brand, color: ink }}>
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-[14px] font-display text-2xl font-semibold" style={{ background: ink, color: brand }} aria-hidden>
                {monogram}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg leading-tight font-bold">{r.library_name}</p>
                {r.address || r.city ? <p className="truncate text-sm opacity-85">{[r.address, r.city].filter(Boolean).join(", ")}</p> : null}
              </div>
            </div>
            <h1 className="mt-5 font-display text-[32px] leading-[1.15] font-medium">{t("title")}</h1>
            <p className="mt-1 flex flex-wrap justify-between gap-x-3 text-sm tabular opacity-90">
              <span>{t("number", { number: r.receipt_number })}</span>
              <span>{formatDay(day, locale, { year: true })}</span>
            </p>
          </header>

          <section className="px-6 pt-6 text-center">
            <p className="text-sm font-medium text-[#55556a]">{t("amount")}</p>
            <p className="mt-1 text-[44px] leading-none font-bold tracking-tight tabular">{formatINR(r.amount_paise)}</p>
            <p className="mt-2 text-[15px] leading-snug text-[#3a3a4e]" lang={locale}>
              {amountInWords(r.amount_paise, locale)}
            </p>
            <p
              className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold ${owed > 0 ? "bg-[#fdf0dc] text-[#8a4b05]" : "bg-[#e3f4ea] text-[#17663a]"}`}
            >
              {owed > 0 ? <Clock className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
              {owed > 0 ? t("stillOwed", { amount: formatINR(owed) }) : t("fullyPaid")}
            </p>
          </section>

          {/* torn-ticket divider */}
          <div className="relative my-6 h-0 border-t-2 border-dashed border-[#e3e0d8]" aria-hidden>
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-bg print:bg-white" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-bg print:bg-white" />
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 px-6">
            <Field label={t("student")} value={r.student_name} sub={`••••${r.phone_last4}`} wide />
            {seatShift ? <Field label={t("seatShift")} value={seatShift} /> : null}
            <Field label={t("method")} value={ta(r.method)} sub={r.reference ?? undefined} />
            {r.period_start && r.period_end ? (
              <Field label={t("validity")} value={`${formatDay(r.period_start, locale)} – ${formatDay(r.period_end, locale, { year: true })}`} wide />
            ) : null}
            {r.plan_name ? <Field label={t("plan")} value={r.plan_name} /> : null}
            <Field label={t("time")} value={time} />
            {r.received_by ? <Field label={t("receivedBy")} value={r.received_by} /> : null}
          </dl>

          <footer className="mt-6 border-t border-[#eeebe3] px-6 pt-4 pb-5 text-center">
            <p className="font-display text-base text-[#3a3a4e]">{t("thanks")}</p>
            {r.whatsapp_number ? <p className="mt-1 text-sm text-[#55556a] tabular">WhatsApp {r.whatsapp_number.replace(/^\+91/, "+91 ")}</p> : null}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[13px] text-[#6b6a7a]">
              <span className="inline-block size-2 rounded-[3px]" style={{ background: brand }} aria-hidden />
              {t("poweredBy")}
            </p>
          </footer>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 print:hidden">
          <Button size="lg" onClick={sharePhoto} loading={busy}>
            {busy ? null : <Share2 aria-hidden />}
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

function Field({ label, value, sub, wide }: { label: string; value: React.ReactNode; sub?: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-sm text-[#55556a]">{label}</dt>
      <dd className="mt-0.5 text-base leading-snug font-semibold">
        {value}
        {sub ? <span className="block text-sm font-normal text-[#55556a] tabular">{sub}</span> : null}
      </dd>
    </div>
  );
}

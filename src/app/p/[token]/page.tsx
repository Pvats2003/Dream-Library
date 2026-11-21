import { CircleCheck, Link2Off, MessageCircle, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import QRCode from "qrcode";
import { LogoMark } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { formatDay, type AppLocale } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { UPI_ID_RE, upiLink } from "@/lib/upi";
import { waLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Pay", robots: { index: false, follow: false } };

type Info = {
  library_name: string;
  city: string | null;
  upi_id: string | null;
  whatsapp_number: string | null;
  student_name: string;
  owed_paise: number;
  status: string;
  plan_name: string | null;
  period_start: string | null;
  period_end: string | null;
};

/** Public: the link in a fee reminder. Shows the amount and a UPI QR. */
export default async function PayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const [{ data }, t, locale] = await Promise.all([supabase.rpc("get_pay_info", { token }), getTranslations("pay"), getLocale() as Promise<AppLocale>]);
  const info = data as Info | null;

  if (!info) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
        <div className="mb-5 grid size-14 place-items-center rounded-full bg-surface-2 text-text-3">
          <Link2Off className="size-7" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">{t("notFound")}</h1>
        <p className="mt-2 text-base text-text-2">{t("notFoundBody")}</p>
      </main>
    );
  }

  const paid = info.owed_paise <= 0 || info.status === "paid" || info.status === "waived";
  const canUpi = !paid && info.upi_id && UPI_ID_RE.test(info.upi_id);
  const link = canUpi ? upiLink({ upiId: info.upi_id!, payeeName: info.library_name, amountPaise: info.owed_paise, note: `Fees ${info.student_name}` }) : null;
  const qr = link ? await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : null;

  return (
    <main className="mx-auto min-h-dvh max-w-md px-5 py-6">
      <div className="flex items-center gap-3">
        <LogoMark className="size-10 rounded-[12px]" />
        <div>
          <p className="text-base font-semibold">{info.library_name}</p>
          {info.city ? <p className="text-xs text-text-3">{info.city}</p> : null}
        </div>
      </div>

      {paid ? (
        <section className="flex flex-col items-center pt-16 text-center">
          <div className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
            <CircleCheck className="size-11" aria-hidden />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t("paid")}</h1>
          <p className="mt-2 text-base text-text-2">{t("paidBody")}</p>
        </section>
      ) : (
        <section className="pt-6">
          <p className="text-lg text-text-2">{t("hello", { name: info.student_name })}</p>
          <h1 className="mt-1 text-base font-semibold text-text-2">{t("due", { library: info.library_name })}</h1>
          <p className="text-[40px] leading-[48px] font-bold tabular">{formatINR(info.owed_paise)}</p>
          {info.plan_name && info.period_start && info.period_end ? (
            <p className="text-base text-text-2">
              {t("period", { plan: info.plan_name, start: formatDay(info.period_start, locale), end: formatDay(info.period_end, locale) })}
            </p>
          ) : null}

          {qr && link ? (
            <>
              <div className="mx-auto mt-6 w-64 rounded-[16px] bg-white p-3" dangerouslySetInnerHTML={{ __html: qr }} />
              <p className="mt-2 text-center text-sm text-text-2">{t("scan")}</p>
              <p className="text-center text-xs text-text-3">{t("upiId", { id: info.upi_id! })}</p>
              <a href={link} className={buttonVariants({ size: "lg", block: true, className: "mt-5" })}>
                <Smartphone aria-hidden />
                {t("openApp")}
              </a>
            </>
          ) : (
            <p className="mt-6 rounded-[14px] bg-surface-2 p-4 text-base">{t("noUpi")}</p>
          )}

          <p className="mt-6 text-base text-text-2">{t("after")}</p>
          {info.whatsapp_number ? (
            <a
              href={waLink(info.whatsapp_number, t("tellText", { amount: formatINR(info.owed_paise), name: info.student_name }))}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "success", size: "lg", block: true, className: "mt-3" })}
            >
              <MessageCircle aria-hidden />
              {t("tellLibrary")}
            </a>
          ) : null}
        </section>
      )}
    </main>
  );
}

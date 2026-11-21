"use client";

import { paymentFeedback } from "@/lib/client/feedback";
import { CircleCheck, Loader2, MessageCircle, QrCode, Receipt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { recordPayment, type PaymentResult } from "@/actions/fees";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChoiceGroup, MoneyInput } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { formatINR } from "@/lib/money";
import { fillTemplate } from "@/lib/templates";
import { UPI_ID_RE, upiLink } from "@/lib/upi";
import { waLink } from "@/lib/whatsapp";

export type PayTarget = {
  invoiceId: string;
  studentId: string;
  studentName: string;
  phone: string;
  owedPaise: number;
};

type Method = "cash" | "upi" | "card" | "bank";

/** Take money for one fee: amount (pre-filled), how, optional UPI QR, receipt after. */
export function RecordPaymentSheet({
  target,
  onClose,
  upiId,
  libraryName,
  receiptTemplate,
}: {
  target: PayTarget | null;
  onClose: () => void;
  upiId: string | null;
  libraryName: string;
  receiptTemplate: string;
}) {
  const t = useTranslations("fees");
  const ta = useTranslations("admit");
  const locale = useLocale();
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("upi");
  const [reference, setReference] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<PaymentResult, { ok: true }> & { paid: number } | null>(null);
  const [opId, setOpId] = useState(() => crypto.randomUUID());
  const [pending, start] = useTransition();
  const [key, setKey] = useState<string | null>(null);

  // A new student opened the sheet: start fresh with the full amount filled in.
  if (target && target.invoiceId !== key) {
    setKey(target.invoiceId);
    setAmount(target.owedPaise);
    setMethod("upi");
    setReference("");
    setShowQr(false);
    setQrSvg(null);
    setError(null);
    setDone(null);
    setOpId(crypto.randomUUID());
  }

  const canQr = Boolean(upiId && UPI_ID_RE.test(upiId) && amount && amount > 0);
  useEffect(() => {
    if (!showQr || !canQr || !target || !amount) return;
    let cancelled = false;
    import("qrcode").then((QR) =>
      QR.toString(upiLink({ upiId: upiId!, payeeName: libraryName, amountPaise: amount, note: `Fees ${target.studentName.split(" ")[0]}` }), {
        type: "svg",
        margin: 1,
      }).then((svg) => !cancelled && setQrSvg(svg)),
    );
    return () => {
      cancelled = true;
    };
  }, [showQr, canQr, upiId, libraryName, amount, target]);

  function save() {
    if (!target) return;
    setError(null);
    if (!amount || amount <= 0) return setError(t("errBadAmount"));
    if (amount > target.owedPaise) return setError(t("errOverpayment"));
    start(async () => {
      const res = await recordPayment({
        invoiceId: target.invoiceId,
        studentId: target.studentId,
        amountPaise: amount,
        method,
        reference,
        clientOpId: opId,
      });
      if (!res.ok) {
        navigator.vibrate?.(80);
        return setError(
          t(res.error === "overpayment" ? "errOverpayment" : res.error === "alreadyPaid" ? "errAlreadyPaid" : res.error === "badAmount" ? "errBadAmount" : "errFailed"),
        );
      }
      paymentFeedback();
      setDone({ ...res, paid: amount });
    });
  }

  const receiptLink = done ? `${window.location.origin}/r/${done.receiptToken}` : "";
  const receiptMsg =
    done && target
      ? fillTemplate(receiptTemplate, {
          name: target.studentName.split(" ")[0],
          amount: formatINR(done.paid),
          library: libraryName,
          receipt_link: receiptLink,
        })
      : "";

  return (
    <Sheet
      open={target !== null}
      onOpenChange={(o) => !o && onClose()}
      title={done ? "" : target ? t("payTitle", { name: target.studentName }) : ""}
      closeLabel={ta("close")}
      footer={
        done || !target ? undefined : (
          <Button size="lg" variant="success" block disabled={pending} onClick={save}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
            {pending ? t("saving") : t("confirmPaid", { amount: formatINR(amount ?? 0) })}
          </Button>
        )
      }
    >
      {target && !done ? (
        <div className="space-y-5">
          <div className="flex items-baseline justify-between rounded-[14px] bg-surface-2 px-4 py-3">
            <span className="text-base text-text-2">{t("owedLabel")}</span>
            <span className="text-2xl font-bold tabular">{formatINR(target.owedPaise)}</span>
          </div>
          <div>
            <label htmlFor="pay-amount" className="mb-2 block text-sm font-semibold text-text-2">
              {t("amount")}
            </label>
            <MoneyInput id="pay-amount" valuePaise={amount} onChange={setAmount} invalid={(amount ?? 0) > target.owedPaise} />
            {amount && amount < target.owedPaise ? (
              <p className="mt-1.5 text-sm text-text-2">{t("stillOwed", { amount: formatINR(target.owedPaise - amount) })}</p>
            ) : null}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-text-2">{t("method")}</p>
            <ChoiceGroup
              label={t("method")}
              columns={4}
              value={method}
              onChange={setMethod}
              options={(["upi", "cash", "card", "bank"] as const).map((m) => ({ value: m, label: ta(m) }))}
            />
          </div>
          {method === "upi" ? (
            <div className="space-y-3">
              {upiId && UPI_ID_RE.test(upiId) ? (
                <Button variant="secondary" block onClick={() => setShowQr(!showQr)}>
                  <QrCode aria-hidden />
                  {showQr ? t("hideQr") : t("showQr")}
                </Button>
              ) : (
                <p className="rounded-[12px] bg-surface-2 px-4 py-3 text-sm text-text-2">{t("noUpi")}</p>
              )}
              {showQr ? (
                <div className="rounded-[16px] border border-border bg-white p-4 text-center">
                  {qrSvg ? <div className="mx-auto w-56" dangerouslySetInnerHTML={{ __html: qrSvg }} /> : <div className="mx-auto h-56 w-56 animate-pulse rounded-[8px] bg-surface-3" />}
                  <p className="mt-2 text-xl font-bold text-[#1a1a2e] tabular">{formatINR(amount ?? 0)}</p>
                  <p className="mt-1 text-sm text-[#5b5b6b]">{t("qrHint")}</p>
                </div>
              ) : null}
              <div>
                <label htmlFor="pay-ref" className="mb-1.5 block text-sm font-semibold text-text-2">
                  {t("reference")}
                </label>
                <Input id="pay-ref" inputMode="numeric" className="h-12 text-base tabular" value={reference} onChange={(e) => setReference(e.target.value.slice(0, 40))} />
              </div>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-[12px] bg-danger-soft px-4 py-3 text-base font-medium text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {target && done ? (
        <section className="flex flex-col items-center pb-2 text-center">
          <div className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
            <CircleCheck className="size-11" aria-hidden />
          </div>
          <h3 className="mt-4 text-2xl font-bold tracking-tight">{t("paidTitle", { amount: formatINR(done.paid) })}</h3>
          <p className="mt-1 text-base text-text-2">{target.studentName}</p>
          <p className="mt-1 text-base font-medium tabular">{t("receiptNo", { number: done.receiptNumber })}</p>
          {done.stillOwedPaise > 0 ? <p className="mt-1 text-base font-medium text-warning">{t("stillOwed", { amount: formatINR(done.stillOwedPaise) })}</p> : null}
          <div className="mt-5 flex w-full flex-col gap-2">
            <a href={waLink(target.phone, receiptMsg)} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "success", size: "lg", block: true })}>
              <MessageCircle aria-hidden />
              {t("sendReceipt")}
            </a>
            <a href={receiptLink} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "secondary", size: "lg", block: true })} lang={locale}>
              <Receipt aria-hidden />
              {t("viewReceipt")}
            </a>
            <Button variant="ghost" block onClick={onClose}>
              {t("close")}
            </Button>
          </div>
        </section>
      ) : null}
    </Sheet>
  );
}

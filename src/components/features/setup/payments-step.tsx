"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { savePaymentDetails } from "@/actions/setup";
import { MoneyInput } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Field, StepShell } from "./step-shell";

export function PaymentsStep({ initial }: { initial: { upiId: string; whatsapp: string; depositPaise: number } }) {
  const t = useTranslations("setup");
  const router = useRouter();
  const [upi, setUpi] = useState(initial.upiId);
  const [wa, setWa] = useState(initial.whatsapp);
  const [deposit, setDeposit] = useState<number | null>(initial.depositPaise);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upiValid = upi.trim() === "" || /^[A-Za-z0-9._-]{2,200}@[A-Za-z]{2,64}$/.test(upi.trim());
  return (
    <StepShell
      step={5}
      title={t("paymentsTitle")}
      hint={t("paymentsHint")}
      pending={pending}
      error={error}
      canSave={upiValid}
      onSave={() =>
        start(async () => {
          const res = await savePaymentDetails({ upiId: upi, whatsapp: wa, depositPaise: deposit ?? 0 });
          if (!res.ok) return setError(res.error === "invalid" ? t("invalidPhone") : t("errFailed"));
          router.push("/setup/staff");
        })
      }
    >
      <div className="space-y-5">
        <Field label={t("upiId")} htmlFor="upi" hint={!upiValid ? t("upiInvalid") : undefined}>
          <Input id="upi" autoCapitalize="none" autoCorrect="off" placeholder={t("upiPlaceholder")} value={upi} onChange={(e) => setUpi(e.target.value.trim())} aria-invalid={!upiValid} />
        </Field>
        <Field label={t("whatsapp")} htmlFor="wa">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-medium text-text-2">+91</span>
            <Input id="wa" inputMode="numeric" className="pl-14 tabular" value={wa} onChange={(e) => setWa(e.target.value.replace(/\D/g, "").slice(-10))} />
          </div>
        </Field>
        <Field label={t("deposit")} htmlFor="deposit" hint={t("depositHint")}>
          <MoneyInput id="deposit" valuePaise={deposit} onChange={setDeposit} />
        </Field>
      </div>
    </StepShell>
  );
}

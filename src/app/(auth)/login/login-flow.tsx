"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { sendCode, verifyCode, type AuthResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatMobile, normalizeIndianMobile } from "@/lib/phone";

const RESEND_SECONDS = 30;

type ErrorKey = Extract<AuthResult, { ok: false }>["error"];

/** "9876543210" → "98765 43210" while typing. */
function prettyLocal(digits: string) {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

export function LoginFlow() {
  const t = useTranslations("login");
  const tc = useTranslations("common");
  const reduce = useReducedMotion();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [digits, setDigits] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, start] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [secondsLeft]);

  function submitPhone() {
    setError(null);
    const normalized = normalizeIndianMobile(digits);
    if (!normalized) {
      setError("invalidPhone");
      return;
    }
    start(async () => {
      const res = await sendCode(normalized);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPhone(res.phone);
      setCode("");
      setStep("code");
      setSecondsLeft(RESEND_SECONDS);
    });
  }

  function submitCode(value = code) {
    if (value.length !== 6) return;
    setError(null);
    start(async () => {
      // On success the server redirects; we only get a result back on failure.
      const res = await verifyCode(phone, value);
      if (res && !res.ok) {
        setError(res.error);
        setCode("");
        navigator.vibrate?.(80);
        codeRef.current?.focus();
      }
    });
  }

  function resend() {
    setError(null);
    start(async () => {
      const res = await sendCode(phone);
      if (!res.ok) setError(res.error);
      else setSecondsLeft(RESEND_SECONDS);
    });
  }

  const slide = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: step === "code" ? 24 : -24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: step === "code" ? -24 : 24 },
      };

  return (
    <form
      className="flex flex-1 flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (step === "phone") submitPhone();
        else submitCode();
      }}
    >
      <div className="flex h-16 items-center">
        {step === "phone" ? (
          <Link
            href="/welcome"
            className="-ml-3 inline-flex h-12 items-center gap-1 rounded-[12px] px-3 text-base font-medium text-text-2 hover:bg-surface-2"
          >
            <ArrowLeft className="size-5" aria-hidden />
            {tc("back")}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
            className="-ml-3 inline-flex h-12 items-center gap-1 rounded-[12px] px-3 text-base font-medium text-text-2 hover:bg-surface-2"
          >
            <ArrowLeft className="size-5" aria-hidden />
            {t("changeNumber")}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step}
          {...slide}
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
          className="pt-6"
        >
          {step === "phone" ? (
            <>
              <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
              <p className="mt-2 text-base text-text-2">{t("subtitle")}</p>
              <label htmlFor="phone" className="mt-8 mb-2 block text-sm font-semibold text-text-2">
                {t("phoneLabel")}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-medium text-text-2 tabular">
                  +91
                </span>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  autoFocus
                  placeholder="98765 43210"
                  className="pl-14 tabular tracking-wide"
                  value={prettyLocal(digits)}
                  aria-invalid={error === "invalidPhone"}
                  aria-describedby={error ? "login-error" : undefined}
                  onChange={(e) => {
                    let d = e.target.value.replace(/\D/g, "");
                    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
                    if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
                    setDigits(d.slice(0, 10));
                    if (error) setError(null);
                  }}
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">{t("codeTitle")}</h1>
              <p className="mt-2 text-base text-text-2">
                {t("codeSubtitle", { phone: formatMobile(phone, true) })}
              </p>
              <label htmlFor="code" className="mt-8 mb-2 block text-sm font-semibold text-text-2">
                {t("codeLabel")}
              </label>
              <Input
                ref={codeRef}
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="••••••"
                className="h-16 text-center text-2xl font-semibold tracking-[0.5em] tabular"
                value={code}
                aria-invalid={error === "wrongCode"}
                aria-describedby={error ? "login-error" : undefined}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (error) setError(null);
                  // SMS autofill and fast typers: log in as soon as all 6 digits are in.
                  if (v.length === 6) submitCode(v);
                }}
              />
              <div className="mt-4 text-center">
                {secondsLeft > 0 ? (
                  <p className="text-sm text-text-3 tabular">{t("resendIn", { seconds: secondsLeft })}</p>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={resend} disabled={pending}>
                    {t("resend")}
                  </Button>
                )}
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      <p
        id="login-error"
        role="alert"
        className={cn("mt-4 min-h-6 text-base font-medium text-danger", !error && "invisible")}
      >
        {error ? t(error) : ""}
      </p>

      <div className="pb-safe mt-auto mb-6 pt-6">
        <Button
          type="submit"
          size="lg"
          block
          disabled={pending || (step === "phone" ? digits.length !== 10 : code.length !== 6)}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {step === "phone" ? (pending ? t("sending") : t("sendCode")) : pending ? t("verifying") : t("verify")}
        </Button>
      </div>
    </form>
  );
}

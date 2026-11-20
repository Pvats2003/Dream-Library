"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const SETUP_STEPS = ["/setup", "/setup/seats", "/setup/shifts", "/setup/plans", "/setup/payments", "/setup/staff"] as const;

/** Frame for each wizard step: progress, one question, one main button. */
export function StepShell({
  step,
  title,
  hint,
  children,
  onSave,
  saveLabel,
  pending,
  error,
  canSave = true,
  hideSkip,
}: {
  step: number;
  title: string;
  hint?: string;
  children: ReactNode;
  onSave: () => void;
  saveLabel?: string;
  pending: boolean;
  error?: string | null;
  canSave?: boolean;
  hideSkip?: boolean;
}) {
  const t = useTranslations("setup");
  const total = SETUP_STEPS.length;
  const prev = SETUP_STEPS[step - 2];
  const next = SETUP_STEPS[step] ?? "/setup/done";
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
        <div className="pt-safe mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          {prev && step > 2 ? (
            <Link href={prev} className="-ml-2 grid size-12 place-items-center rounded-full text-text-2 hover:bg-surface-2" aria-label={t("back")}>
              <ArrowLeft className="size-6" aria-hidden />
            </Link>
          ) : (
            <span className="size-10" aria-hidden />
          )}
          <div className="flex flex-1 gap-1.5" aria-hidden>
            {SETUP_STEPS.map((s, i) => (
              <span key={s} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-brand" : "bg-surface-3")} />
            ))}
          </div>
          <span className="text-sm text-text-3 tabular">{t("stepOf", { step, total })}</span>
        </div>
      </div>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-6">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {hint ? <p className="mt-1.5 text-base text-text-2">{hint}</p> : null}
        <div className="mt-6">{children}</div>
        {error ? (
          <p role="alert" className="mt-4 rounded-[12px] bg-danger-soft px-4 py-3 text-base font-medium text-danger">
            {error}
          </p>
        ) : null}
      </main>
      <div className="pb-safe sticky bottom-0 border-t border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {!hideSkip ? (
            <Link href={next} className={buttonVariants({ variant: "ghost", size: "lg" })}>
              {t("skip")}
            </Link>
          ) : null}
          <Button size="lg" block onClick={onSave} disabled={pending || !canSave}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {pending ? t("saving") : (saveLabel ?? t("saveNext"))}
          </Button>
        </div>
        <p className="pb-2 text-center text-xs text-text-3">{t("laterHint")}</p>
      </div>
    </div>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: ReactNode; hint?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-text-2">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-sm text-text-3">{hint}</p> : null}
    </div>
  );
}

/** − 5 + stepper: big buttons, no tiny spinner arrows. */
export function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex h-12 items-center rounded-[12px] border border-border-strong bg-surface" role="group" aria-label={label}>
      <button
        type="button"
        className="grid h-full w-12 place-items-center text-2xl font-semibold text-text-2 disabled:opacity-30"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`${label} −1`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="h-full w-full min-w-0 bg-transparent text-center text-lg font-semibold tabular focus:outline-none"
      />
      <button
        type="button"
        className="grid h-full w-12 place-items-center text-2xl font-semibold text-text-2 disabled:opacity-30"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`${label} +1`}
      >
        +
      </button>
    </div>
  );
}

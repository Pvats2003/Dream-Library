"use client";

import { Check, X as Cross } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type Toast = { id: number; message: string; tone: "success" | "error"; action?: { label: string; onClick: () => void } };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Short confirmation at the bottom of the screen. Errors stay a little longer. */
export function toast(message: string, opts: { tone?: Toast["tone"]; action?: Toast["action"] } = {}) {
  const t: Toast = { id: nextId++, message, tone: opts.tone ?? "success", action: opts.action };
  toasts = [...toasts.slice(-2), t];
  emit();
  // A small buzz only in answer to something the person just did (not tips on page open).
  if (t.tone === "success" && navigator.userActivation?.hasBeenActive) navigator.vibrate?.(15);
  return t.id;
}

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6"
    >
      {list.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}

function ToastItem({ t }: { t: Toast }) {
  useEffect(() => {
    const id = setTimeout(() => dismiss(t.id), t.tone === "error" ? 7000 : 5000);
    return () => clearTimeout(id);
  }, [t]);
  const Icon = t.tone === "success" ? Check : Cross;
  return (
    <div
      role={t.tone === "error" ? "alert" : "status"}
      className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[14px] bg-text px-4 py-3 text-bg shadow-[var(--shadow-pop)]"
    >
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-on-solid", t.tone === "success" ? "bg-success-solid" : "bg-danger-solid")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="flex-1 text-base font-medium">{t.message}</p>
      {t.action ? (
        <button
          type="button"
          className="h-10 shrink-0 rounded-[10px] px-3 text-base font-semibold text-brand-soft"
          onClick={() => {
            t.action?.onClick();
            dismiss(t.id);
          }}
        >
          {t.action.label}
        </button>
      ) : null}
    </div>
  );
}

/** A still copy of a toast, for the Design Lab. */
export function ToastPreview({ message, tone = "success", actionLabel }: { message: string; tone?: Toast["tone"]; actionLabel?: string }) {
  const Icon = tone === "success" ? Check : Cross;
  return (
    <div className="flex w-full max-w-md items-center gap-3 rounded-[14px] bg-text px-4 py-3 text-bg shadow-[var(--shadow-pop)]">
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-on-solid", tone === "success" ? "bg-success-solid" : "bg-danger-solid")}>
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="flex-1 text-base font-medium">{message}</p>
      {actionLabel ? <span className="h-10 shrink-0 rounded-[10px] px-3 py-2 text-base font-semibold text-brand-soft">{actionLabel}</span> : null}
    </div>
  );
}

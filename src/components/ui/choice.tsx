"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Big tappable options (radio group). Selected = brand border + tick. */
export function ChoiceGroup<T extends string>({
  value,
  onChange,
  options,
  label,
  columns = 2,
  className,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: ReactNode }[];
  label: string;
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "grid gap-2",
        { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns],
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex min-h-12 flex-col items-start justify-center rounded-[12px] border px-4 py-2.5 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98]",
              active ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border-strong bg-surface hover:bg-surface-2",
            )}
          >
            <span className="pr-6 text-base font-semibold">{o.label}</span>
            {o.hint ? <span className={cn("text-sm", active ? "text-brand-soft-fg/80" : "text-text-2")}>{o.hint}</span> : null}
            {active ? (
              <span className="absolute top-1/2 right-3 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-brand text-brand-fg">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Rupee amount with a numeric keypad and Indian grouping as you type. */
export function MoneyInput({
  valuePaise,
  onChange,
  id,
  invalid,
  describedBy,
  autoFocus,
}: {
  valuePaise: number | null;
  onChange: (paise: number | null) => void;
  id: string;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const rupees = valuePaise === null ? "" : new Intl.NumberFormat("en-IN").format(Math.floor(valuePaise / 100));
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-xl font-semibold text-text-2">₹</span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        value={rupees}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
          onChange(digits ? Number(digits) * 100 : null);
        }}
        className={cn(
          "h-14 w-full rounded-[10px] border border-border-input bg-surface pr-4 pl-10 text-xl font-semibold tabular",
          "focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none",
          invalid && "border-danger",
        )}
      />
    </div>
  );
}

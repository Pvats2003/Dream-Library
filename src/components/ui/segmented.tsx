"use client";

import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex gap-1 overflow-x-auto rounded-[14px] bg-surface-2 p-1", className)}>
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
              "relative h-11 min-w-fit flex-1 rounded-[10px] px-2.5 text-sm font-semibold whitespace-nowrap transition-colors duration-150",
              active ? "text-text" : "text-text-2 hover:text-text",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-0 rounded-[10px] border border-border bg-surface shadow-sm transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

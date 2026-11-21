"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";

/**
 * A row of choices where the selected one sits on a card that slides
 * across (a soft spring) when you pick another. Arrow keys move too.
 */
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
  const wrap = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);

  useLayoutEffect(() => {
    const root = wrap.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!el) return setPill(null);
      setPill({ x: el.offsetLeft, w: el.offsetWidth });
      const { scrollLeft, clientWidth } = root;
      if (el.offsetLeft < scrollLeft || el.offsetLeft + el.offsetWidth > scrollLeft + clientWidth) {
        root.scrollTo({ left: el.offsetLeft - 16, behavior: "smooth" });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [value, options.length]);

  function onKey(e: KeyboardEvent) {
    const i = options.findIndex((o) => o.value === value);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    wrap.current?.querySelector<HTMLElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
  }

  return (
    <div
      ref={wrap}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKey}
      className={cn("relative flex gap-1 overflow-x-auto rounded-[14px] bg-surface-2 p-1 [scrollbar-width:none]", className)}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-[10px] border border-border bg-surface shadow-sm dark:border-border-heavy dark:bg-surface-press transition-[transform,width,opacity] duration-[420ms] ease-[cubic-bezier(0.34,1.36,0.64,1)] motion-reduce:transition-none"
        style={{ transform: `translateX(${pill?.x ?? 0}px)`, width: pill?.w ?? 0, opacity: pill ? 1 : 0 }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-[1] h-11 min-w-fit flex-1 rounded-[10px] px-3 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150",
              active ? "text-text" : "text-text-2 hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

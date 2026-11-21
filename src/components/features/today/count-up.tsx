"use client";

import { useLayoutEffect, useRef } from "react";
import { formatINR } from "@/lib/money";

/**
 * A big number that counts up once (400ms) when the screen opens. The
 * server already renders the final value, so nothing jumps if scripts are
 * slow, and people who turn off motion just see the number.
 */
export function CountUp({ value, money = false, className }: { value: number; money?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (n: number) => (money ? formatINR(n) : new Intl.NumberFormat("en-IN").format(n));
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 400);
      const eased = 1 - (1 - p) ** 3;
      const n = p === 1 ? value : Math.round(value * eased);
      el.textContent = fmt(money ? Math.round(n / 100) * 100 : n);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    el.textContent = fmt(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per value
  }, [value]);
  return (
    <span ref={ref} className={className ? `tabular ${className}` : "tabular"}>
      {fmt(value)}
    </span>
  );
}

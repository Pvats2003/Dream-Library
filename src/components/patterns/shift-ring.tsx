import { cn } from "@/lib/cn";

/**
 * A ring that fills as seats are taken; the big number in the middle is
 * how many are still free.
 */
export function ShiftRing({ free, total, label, sublabel, ariaLabel }: { free: number; total: number; label: string; sublabel?: string; ariaLabel: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const taken = total > 0 ? (total - free) / total : 0;
  const low = total > 0 && free / total < 0.1;
  return (
    <figure className="flex flex-col items-center gap-2" aria-label={ariaLabel}>
      <div className="relative size-[72px]">
        <svg viewBox="0 0 64 64" className="size-full -rotate-90" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-surface-3" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${c * taken} ${c}`}
            className={cn("transition-[stroke-dasharray] duration-700 ease-out", low ? "stroke-warning" : "stroke-brand")}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-xl font-bold tabular">{free}</span>
      </div>
      <figcaption className="text-center">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        {sublabel ? <span className="block text-xs text-text-3 tabular">{sublabel}</span> : null}
      </figcaption>
    </figure>
  );
}

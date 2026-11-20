import { cn } from "@/lib/cn";

function initials(name: string) {
  const parts = name.replace(/^Md\.?\s+/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "")).toUpperCase();
}

// A stable, soft hue per person so the list is easy to scan.
const HUES = [272, 200, 152, 30, 330, 95, 245, 12];
function hueFor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- signed storage URLs
    return <img src={src} alt="" className={cn("size-12 shrink-0 rounded-full object-cover", className)} />;
  }
  const hue = hueFor(name);
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full text-base font-semibold",
        "bg-[oklch(0.93_0.04_var(--h))] text-[oklch(0.38_0.1_var(--h))]",
        "dark:bg-[oklch(0.33_0.06_var(--h))] dark:text-[oklch(0.88_0.06_var(--h))]",
        className,
      )}
      style={{ "--h": hue } as React.CSSProperties}
    >
      {initials(name)}
    </span>
  );
}

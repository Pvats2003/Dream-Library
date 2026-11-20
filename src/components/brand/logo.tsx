import { cn } from "@/lib/cn";

/** App mark: an open book in a rounded square. Brand colour, no gradients. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("grid size-14 place-items-center rounded-[16px] bg-brand text-brand-fg", className)} aria-hidden>
      <svg viewBox="0 0 24 24" className="size-[58%]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 7v13" />
        <path d="M3 17.5V5.2c0-.4.3-.7.7-.7C6.8 4.5 9.6 5.3 12 7c2.4-1.7 5.2-2.5 8.3-2.5.4 0 .7.3.7.7v12.3c0 .4-.3.7-.7.7-3 0-5.8.8-8.3 2.5-2.5-1.7-5.3-2.5-8.3-2.5-.4 0-.7-.3-.7-.7Z" />
      </svg>
    </span>
  );
}

import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";

/** Money always uses tabular figures and Indian grouping. */
export function Money({ paise, className }: { paise: number; className?: string }) {
  return <span className={cn("tabular", className)}>{formatINR(paise)}</span>;
}

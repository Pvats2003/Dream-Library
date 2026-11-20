import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-[10px] bg-surface-3 motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

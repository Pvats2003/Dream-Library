import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-14 w-full rounded-[10px] border border-border-strong bg-surface px-4 text-lg text-text",
        "placeholder:text-text-3 transition-[border-color,box-shadow] duration-150",
        "focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15",
        "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15",
        className,
      )}
      {...props}
    />
  );
}

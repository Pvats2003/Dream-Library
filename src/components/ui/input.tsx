import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-14 w-full rounded-[10px] border border-border-input bg-surface px-4 text-lg text-text",
        "placeholder:text-text-3 transition-[border-color,box-shadow] duration-150",
        "hover:border-border-heavy focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20",
        "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-text-3",
        "aria-[invalid=true]:border-danger-solid aria-[invalid=true]:ring-danger/15",
        className,
      )}
      {...props}
    />
  );
}

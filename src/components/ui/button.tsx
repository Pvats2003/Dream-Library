import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Buttons always carry a text label. Minimum height 48px (56px for the
 * main action on a screen) so they're easy to hit with a thumb.
 */
export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[12px] font-semibold select-none",
    "transition-[background-color,color,transform,box-shadow,border-color] duration-150 ease-out active:scale-[0.97]",
    "disabled:opacity-45 disabled:active:scale-100 aria-busy:cursor-progress",
    "[&_svg]:size-5 [&_svg]:shrink-0 aria-busy:[&>svg:not([data-spin])]:hidden",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg shadow-sm hover:bg-brand-hover active:bg-brand-press",
        secondary: "border border-border-strong bg-surface text-text hover:border-border-heavy hover:bg-surface-hover active:bg-surface-press",
        soft: "bg-brand-soft text-brand-soft-fg hover:brightness-[0.97] active:brightness-[0.94]",
        ghost: "text-text-2 hover:bg-surface-hover hover:text-text active:bg-surface-press",
        danger: "bg-danger-solid text-on-solid shadow-sm hover:brightness-[0.95] active:brightness-[0.9]",
        success: "bg-success-solid text-on-solid shadow-sm hover:brightness-[0.95] active:brightness-[0.9]",
      },
      size: {
        md: "h-12 px-4 text-base",
        lg: "h-14 px-5 text-lg",
        sm: "h-10 px-3 text-sm [&_svg]:size-4",
      },
      block: { true: "w-full" },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner in place of the icon and blocks repeat taps. */
    loading?: boolean;
  };

export function Button({ className, variant, size, block, asChild, loading, children, disabled, ...props }: ButtonProps) {
  if (asChild) {
    return <Slot.Root className={cn(buttonVariants({ variant, size, block }), className)} {...props}>{children}</Slot.Root>;
  }
  return (
    <button
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 data-spin="" className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
      {children}
    </button>
  );
}

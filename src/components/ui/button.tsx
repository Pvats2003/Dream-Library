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
    "transition-[background-color,color,transform,box-shadow] duration-150 ease-out active:scale-[0.98]",
    "disabled:opacity-50 disabled:active:scale-100",
    "[&_svg]:size-5 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg hover:bg-brand-hover",
        secondary: "bg-surface text-text border border-border-strong hover:bg-surface-2",
        soft: "bg-brand-soft text-brand-soft-fg hover:brightness-[0.97]",
        ghost: "text-text-2 hover:bg-surface-2 hover:text-text",
        danger: "bg-danger text-white hover:brightness-95",
        success: "bg-success text-white hover:brightness-95",
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

type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, block, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}

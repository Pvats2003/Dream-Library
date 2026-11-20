"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One component, two shapes: a bottom sheet on phones, a right-hand panel
 * on desktop (the list behind stays visible).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel: string;
  className?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          className={cn(
            "sheet-content fixed z-50 flex flex-col bg-surface text-text shadow-[var(--shadow-sheet)] focus:outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[20px]",
            "lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[460px] lg:rounded-none lg:rounded-l-[20px]",
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-border-strong lg:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2 lg:pt-6">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-bold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-base text-text-2">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{typeof title === "string" ? title : ""}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-2 grid size-12 shrink-0 place-items-center rounded-full text-text-2 hover:bg-surface-2"
              aria-label={closeLabel}
            >
              <X className="size-6" aria-hidden />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
          {footer ? <div className="pb-safe border-t border-border px-5 pt-3 pb-4">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

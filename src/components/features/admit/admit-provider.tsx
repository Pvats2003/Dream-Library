"use client";

import { Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { AdmitPrefill } from "./admit-flow";

// The admit sheet is only downloaded when someone opens it.
const AdmitFlow = dynamic(() => import("./admit-flow").then((m) => m.AdmitFlow), { ssr: false });

const AdmitContext = createContext<((prefill?: AdmitPrefill) => void) | null>(null);

export function useAdmit() {
  const open = use(AdmitContext);
  if (!open) throw new Error("useAdmit must be used inside AdmitProvider");
  return open;
}

export function AdmitProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [prefill, setPrefill] = useState<AdmitPrefill | undefined>();
  const openAdmit = useCallback((p?: AdmitPrefill) => {
    setPrefill(p);
    setMounted(true);
    setOpen(true);
  }, []);
  return (
    <AdmitContext value={openAdmit}>
      {children}
      {mounted ? <AdmitFlow open={open} onOpenChange={setOpen} prefill={prefill} /> : null}
    </AdmitContext>
  );
}

/** Big labelled button: floating above the tabs on phones, in the sidebar on desktop. */
export function AdmitButton({ variant }: { variant: "fab" | "sidebar" }) {
  const t = useTranslations("admit");
  const openAdmit = useAdmit();
  return (
    <button
      type="button"
      onClick={() => openAdmit()}
      className={cn(
        "flex items-center justify-center gap-2 bg-brand font-semibold print:hidden text-brand-fg transition-[transform,background-color] duration-150 hover:bg-brand-hover active:scale-[0.97]",
        variant === "fab"
          ? "fixed right-4 bottom-[calc(76px+env(safe-area-inset-bottom))] z-40 h-14 rounded-[18px] px-5 text-base shadow-[var(--shadow-pop)] lg:hidden"
          : "h-12 w-full rounded-[12px] text-base",
      )}
    >
      <Plus className="size-5" strokeWidth={2.6} aria-hidden />
      {t("open")}
    </button>
  );
}

/**
 * Opens the admit sheet straight away when arriving with ?add=1 (from the
 * end of setup). The visible buttons are the floating one and the sidebar's.
 */
export function AdmitAutoOpen({ when }: { when: boolean }) {
  const openAdmit = useAdmit();
  const done = useRef(false);
  useEffect(() => {
    if (when && !done.current) {
      done.current = true;
      openAdmit();
    }
  }, [when, openAdmit]);
  return null;
}

"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLocale } from "@/actions/preferences";
import { cn } from "@/lib/cn";

const OPTIONS = [
  { locale: "hi", label: "हिंदी", hint: "Hindi" },
  { locale: "en", label: "English", hint: "अंग्रेज़ी" },
] as const;

export function LanguageChoice() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((o) => (
        <button
          key={o.locale}
          type="button"
          lang={o.locale}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setLocale(o.locale);
              router.push("/login");
            })
          }
          className={cn(
            "flex h-[72px] items-center justify-between rounded-[14px] border border-border-strong bg-surface px-5 text-left",
            "transition-[transform,border-color,background-color] duration-150 active:scale-[0.98] hover:border-brand",
            "disabled:opacity-60",
          )}
        >
          <span>
            <span className="block text-xl font-semibold">{o.label}</span>
            <span className="block text-sm text-text-2">{o.hint}</span>
          </span>
          <ChevronRight className="size-6 text-text-3" aria-hidden />
        </button>
      ))}
    </div>
  );
}

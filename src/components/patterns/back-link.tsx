"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

const KEY = "libraryos:moved";

/** Remembers that the person has moved between pages inside the app this session. */
export function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // Private mode: fall back to normal links.
    }
  }, [pathname]);
  return null;
}

/**
 * "← Students" that behaves like the phone's back button (instant, keeps the
 * scroll position) when they came from inside the app; otherwise a normal link.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        let moved = false;
        try {
          moved = sessionStorage.getItem(KEY) === "1";
        } catch {}
        if (moved && window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
      className="-ml-3 inline-flex h-12 items-center gap-1 rounded-[12px] px-3 text-base font-medium text-text-2 hover:bg-surface-2"
    >
      <ArrowLeft className="size-5" aria-hidden />
      {children}
    </Link>
  );
}

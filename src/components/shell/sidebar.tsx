"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogoMark } from "@/components/brand/logo";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

/** Left sidebar on desktop. */
export function Sidebar({ libraryName, city }: { libraryName: string; city: string | null }) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5 lg:flex">
      <div className="mb-6 flex items-center gap-3 px-2">
        <LogoMark className="size-10 rounded-[12px]" />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{libraryName}</p>
          {city ? <p className="truncate text-xs text-text-3">{city}</p> : null}
        </div>
      </div>
      <nav aria-label="Main">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ href, key, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-[12px] px-3 text-base font-medium transition-colors duration-150",
                    active ? "bg-brand-soft text-brand-soft-fg" : "text-text-2 hover:bg-surface-2 hover:text-text",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} aria-hidden />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

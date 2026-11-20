"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-items";

/** Bottom tabs on phones: icon + word, like the apps the owner already uses. */
export function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {NAV_ITEMS.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch
                onPointerDown={() => router.prefetch(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-xs font-semibold",
                  active ? "text-brand" : "text-text-2",
                )}
              >
                <span className="relative grid h-8 w-14 place-items-center">
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 rounded-full bg-brand-soft transition-[opacity,transform] duration-200 ease-out",
                      active ? "scale-100 opacity-100" : "scale-75 opacity-0",
                    )}
                  />
                  <Icon className="relative size-[22px]" strokeWidth={active ? 2.4 : 2} aria-hidden />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

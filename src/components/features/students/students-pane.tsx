"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

/**
 * The student list. On the Students tab it is the whole screen on phones;
 * on desktop it stays on the left while a profile is open on the right.
 */
export function StudentsPane({ title, children }: { title: string; children: React.ReactNode }) {
  const isIndex = usePathname() === "/students";
  const Heading = isIndex ? "h1" : "h2";
  return (
    <aside
      aria-label={title}
      className={cn(
        "lg:sticky lg:top-0 lg:block lg:max-h-dvh lg:overflow-y-auto lg:pt-10 lg:pb-8",
        isIndex ? "block pt-6" : "hidden",
      )}
    >
      <Heading className="text-2xl leading-tight font-bold tracking-tight lg:text-[28px]">{title}</Heading>
      {children}
    </aside>
  );
}

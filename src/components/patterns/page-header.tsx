import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-4 pt-6 pb-5 lg:pt-10">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight lg:text-[32px] lg:leading-10">{title}</h1>
        {subtitle ? <div className="mt-1 text-base text-text-2">{subtitle}</div> : null}
      </div>
      {action}
    </header>
  );
}

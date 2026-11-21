import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ART } from "./illustrations";

/** A small drawing (or icon), one sentence and the next thing to do. */
export function EmptyState({
  icon: Icon,
  art,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  art?: keyof typeof ART;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  const Art = art ? ART[art] : null;
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Art ? (
        <Art className="mb-4 h-28 w-auto text-text-2" />
      ) : Icon ? (
        <div className="mb-4 grid size-14 place-items-center rounded-full bg-surface-2 text-text-3">
          <Icon className="size-7" aria-hidden />
        </div>
      ) : null}
      <p className="text-lg font-semibold text-balance text-text">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-base text-balance text-text-2">{body}</p> : null}
      {action ? <div className="mt-6 w-full max-w-xs">{action}</div> : null}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** One sentence and, where it helps, the next thing to do. No illustrations. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-full bg-surface-2 text-text-3">
        <Icon className="size-7" aria-hidden />
      </div>
      <p className="text-lg font-semibold text-text">{title}</p>
      {body ? <p className="mt-1 max-w-sm text-base text-text-2">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

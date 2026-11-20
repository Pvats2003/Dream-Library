import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy>
      <div className="pt-6 pb-5 lg:pt-10">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-5 w-24" />
      </div>
      <Skeleton className="h-12 rounded-[12px]" />
      <Skeleton className="mt-3 h-[52px] rounded-[14px]" />
      <div className="mt-3 overflow-hidden rounded-[14px] border border-border bg-surface">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-1.5 h-4 w-56" />
            </div>
            <Skeleton className="h-7 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

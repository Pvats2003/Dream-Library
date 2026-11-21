import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the Today screen so nothing jumps when it loads. */
export default function Loading() {
  return (
    <div aria-busy>
      <div className="pt-7 pb-6 lg:pt-12 lg:pb-8">
        <Skeleton className="h-5 w-28 lg:hidden" />
        <Skeleton className="mt-2 h-10 w-64 lg:h-12 lg:w-96" />
        <Skeleton className="mt-2 h-5 w-40" />
      </div>
      <div className="grid divide-y divide-border rounded-[20px] border border-border bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="px-5 py-5 lg:px-6 lg:py-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-3 h-10 w-36 lg:h-12" />
            <Skeleton className="mt-2 h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-6">
        <Skeleton className="h-[340px] rounded-[20px]" />
        <Skeleton className="h-[220px] rounded-[20px]" />
      </div>
    </div>
  );
}

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy className="pt-4 lg:pt-8">
      <Skeleton className="h-12 w-32" />
      <div className="mt-2 flex items-center gap-4">
        <Skeleton className="size-[72px] rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-2 h-5 w-36" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-[12px]" />
        ))}
      </div>
      <Skeleton className="mt-4 h-40 rounded-[14px]" />
      <Skeleton className="mt-5 h-[52px] rounded-[14px]" />
      <Skeleton className="mt-4 h-64 rounded-[14px]" />
    </div>
  );
}

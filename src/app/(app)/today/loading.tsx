import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy>
      <div className="pt-6 pb-5 lg:pt-10">
        <Skeleton className="h-5 w-28 lg:hidden" />
        <Skeleton className="mt-2 h-8 w-44" />
        <Skeleton className="mt-2 h-5 w-36" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[154px] rounded-[14px]" />
        ))}
      </div>
      <Skeleton className="mt-4 h-[180px] rounded-[14px] lg:mt-6" />
    </div>
  );
}

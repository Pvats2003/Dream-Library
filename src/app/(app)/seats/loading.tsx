import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy>
      <div className="pt-6 pb-5 lg:pt-10">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="mt-2 h-5 w-36" />
      </div>
      <Skeleton className="h-[52px] rounded-[14px]" />
      <Skeleton className="mt-4 h-[290px] rounded-[14px]" />
      <Skeleton className="mt-4 h-[150px] rounded-[14px]" />
    </div>
  );
}

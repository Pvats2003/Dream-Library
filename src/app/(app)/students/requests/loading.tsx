import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy className="pt-4 lg:pt-8">
      <Skeleton className="h-12 w-32" />
      <Skeleton className="mt-2 h-8 w-44" />
      <Skeleton className="mt-2 h-5 w-56" />
      <Skeleton className="mt-4 h-14 rounded-[12px]" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="mt-3 h-44 rounded-[14px]" />
      ))}
    </div>
  );
}

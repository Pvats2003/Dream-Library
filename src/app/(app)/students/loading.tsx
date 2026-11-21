import { Skeleton } from "@/components/ui/skeleton";

/** Only the right-hand side on desktop; the list has its own skeleton. */
export default function Loading() {
  return (
    <div aria-busy className="hidden pt-10 lg:block">
      <Skeleton className="min-h-[60dvh] rounded-[20px]" />
    </div>
  );
}

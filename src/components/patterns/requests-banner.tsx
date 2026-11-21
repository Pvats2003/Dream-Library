import { ChevronRight, Inbox } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

/** "3 नए अनुरोध" — students who sent their details and are waiting. */
export async function RequestsBanner({ count }: { count: number }) {
  if (count === 0) return null;
  const t = await getTranslations("requests");
  return (
    <Link
      href="/students/requests"
      prefetch
      className="mb-4 flex min-h-14 items-center gap-3 rounded-[14px] border border-info/30 bg-info-soft px-4 py-3 text-info transition-colors hover:brightness-[0.98]"
    >
      <Inbox className="size-5 shrink-0" aria-hidden />
      <span className="flex-1 text-base font-semibold">{t("banner", { count })}</span>
      <ChevronRight className="size-5" aria-hidden />
    </Link>
  );
}

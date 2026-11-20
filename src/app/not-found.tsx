import { Compass } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-full bg-surface-2 text-text-3">
        <Compass className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">{t("notFoundTitle")}</h1>
      <p className="mt-2 text-base text-text-2">{t("notFoundBody")}</p>
      <Link href="/today" className={buttonVariants({ className: "mt-8" })}>
        {t("goHome")}
      </Link>
    </main>
  );
}

"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 grid size-14 place-items-center rounded-full bg-danger-soft text-danger">
        <TriangleAlert className="size-7" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">{t("somethingWrong")}</h1>
      <p className="mt-2 text-base text-text-2">{t("somethingWrongBody")}</p>
      <Button className="mt-8" onClick={reset}>
        <RotateCcw aria-hidden />
        {t("tryAgain")}
      </Button>
    </main>
  );
}

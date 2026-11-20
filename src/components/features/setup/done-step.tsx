"use client";

import { CircleCheck, UserPlus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";

export function DoneStep() {
  const t = useTranslations("setup");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
        <CircleCheck className="size-11" aria-hidden />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">{t("doneTitle")}</h1>
      <p className="mt-2 text-base text-text-2">{t("doneBody")}</p>
      <div className="mt-8 flex w-full flex-col gap-2">
        <Link href="/students?add=1" className={buttonVariants({ size: "lg", block: true })}>
          <UserPlus aria-hidden />
          {t("addStudents")}
        </Link>
        <Link href="/today" className={buttonVariants({ variant: "secondary", size: "lg", block: true })}>
          {t("goToday")}
        </Link>
      </div>
    </main>
  );
}

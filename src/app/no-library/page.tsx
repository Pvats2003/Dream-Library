import { Plus, Store } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/actions/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { requireViewer } from "@/lib/session";

export default async function NoLibraryPage() {
  const viewer = await requireViewer();
  if (viewer.memberships.length > 0) redirect("/today");
  const t = await getTranslations("noLibrary");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 text-center">
      <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-surface-2 text-text-3">
        <Store className="size-8" aria-hidden />
      </div>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <div className="mt-6 rounded-[14px] border border-border bg-surface p-5 text-left">
        <h2 className="text-base font-semibold">{t("ownerTitle")}</h2>
        <Link href="/setup" className={buttonVariants({ size: "lg", block: true, className: "mt-3" })}>
          <Plus aria-hidden />
          {t("create")}
        </Link>
      </div>
      <div className="mt-3 rounded-[14px] border border-border bg-surface p-5 text-left">
        <h2 className="text-base font-semibold">{t("staffTitle")}</h2>
        <p className="mt-1 text-base text-text-2">{t("body")}</p>
      </div>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="ghost" block>
          {t("logout")}
        </Button>
      </form>
    </main>
  );
}

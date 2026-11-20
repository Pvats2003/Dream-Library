import { Store } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/actions/auth";
import { Button } from "@/components/ui/button";
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
      <p className="mt-2 text-base text-text-2">{t("body")}</p>
      <form action={signOut} className="mt-8">
        <Button type="submit" variant="secondary" block>
          {t("logout")}
        </Button>
      </form>
    </main>
  );
}

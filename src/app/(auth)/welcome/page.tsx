import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/brand/logo";
import { LanguageChoice } from "./language-choice";

export const metadata: Metadata = { title: "Namaste" };

export default async function WelcomePage() {
  const t = await getTranslations("welcome");
  return (
    <>
      <div className="flex flex-1 flex-col justify-center py-12">
        <LogoMark />
        <h1 className="mt-8 text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-lg text-text-2">{t("subtitle")}</p>
      </div>
      <div className="pb-safe mb-8">
        {/* Shown in both scripts: they haven't chosen yet. */}
        <h2 className="mb-4 text-base font-semibold text-text-2">अपनी भाषा चुनें · Choose your language</h2>
        <LanguageChoice />
        <p className="mt-4 text-center text-sm text-text-3">{t("changeLater")}</p>
      </div>
    </>
  );
}

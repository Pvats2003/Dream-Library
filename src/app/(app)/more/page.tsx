import { ChevronRight, LogOut, MessageCircle, QrCode, Settings } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/actions/auth";
import { LogoMark } from "@/components/brand/logo";
import { LanguageSwitch, LibrarySwitch, ThemeSwitch } from "@/components/features/preferences";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SUPPORT_WHATSAPP } from "@/lib/env";
import { formatMobile } from "@/lib/phone";
import { requireLibrary } from "@/lib/session";
import { THEME_COOKIE, isThemePref } from "@/lib/theme";

export const metadata: Metadata = { title: "More" };

const ROLE_KEY = { owner: "roleOwner", manager: "roleManager", desk: "roleDesk" } as const;

export default async function MorePage() {
  const { viewer, membership } = await requireLibrary();
  const library = { name: membership.libraryName, city: membership.city };
  const [t, ts, tj, themeCookie] = await Promise.all([
    getTranslations("more"),
    getTranslations("setup"),
    getTranslations("joinShare"),
    cookies().then((c) => c.get(THEME_COOKIE)?.value),
  ]);
  const help = SUPPORT_WHATSAPP
    ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Namaste Priyanshu, main ${library.name} se hoon. Mujhe app mein madad chahiye.`)}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} />

      <Card className="-mt-2 flex items-center gap-4 p-4">
        <LogoMark className="size-12 rounded-[14px]" />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{library.name}</p>
          <p className="truncate text-sm text-text-2">
            {library.city ? `${library.city} · ` : ""}
            {t("yourRole", { role: t(ROLE_KEY[membership.role]) })}
          </p>
        </div>
      </Card>

      {viewer.memberships.length > 1 ? (
        <Section title={t("switchLibrary")}>
          <LibrarySwitch
            current={membership.libraryId}
            options={viewer.memberships.map((m) => ({ id: m.libraryId, name: m.libraryName }))}
          />
        </Section>
      ) : null}

      <Link
        href="/more/join"
        className="flex min-h-16 items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
      >
        <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand-soft-fg">
          <QrCode className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold">{tj("linkTitle")}</span>
          <span className="block text-sm text-text-2">{tj("linkHint")}</span>
        </span>
        <ChevronRight className="size-5 text-text-3" aria-hidden />
      </Link>

      {membership.permissions.can_edit_settings ? (
        <Link
          href="/setup/seats"
          className="flex min-h-16 items-center gap-3 rounded-[14px] border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
        >
          <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand-soft-fg">
            <Settings className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">{ts("settingsLink")}</span>
            <span className="block text-sm text-text-2">{ts("settingsHint")}</span>
          </span>
          <ChevronRight className="size-5 text-text-3" aria-hidden />
        </Link>
      ) : null}

      <Section title={t("language")}>
        <LanguageSwitch />
      </Section>

      <Section title={t("theme")}>
        <ThemeSwitch initial={isThemePref(themeCookie) ? themeCookie : "system"} />
      </Section>

      {help ? (
        <Section title={t("help")}>
          <a
            href={help}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-16 items-center gap-3 rounded-[14px] border border-border bg-surface px-4 transition-colors hover:bg-surface-2"
          >
            <span className="grid size-10 place-items-center rounded-full bg-success-soft text-success">
              <MessageCircle className="size-5" aria-hidden />
            </span>
            <span className="text-base font-semibold">{t("helpBody")}</span>
          </a>
        </Section>
      ) : null}

      <div className="pt-2">
        {viewer.phone ? (
          <p className="mb-3 text-center text-sm text-text-3 tabular">{t("loggedInAs", { phone: formatMobile(viewer.phone, true) })}</p>
        ) : null}
        <form action={signOut}>
          <Button type="submit" variant="secondary" block className="text-danger">
            <LogOut aria-hidden />
            {t("logout")}
          </Button>
        </form>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-sm font-semibold text-text-2">{title}</h2>
      {children}
    </section>
  );
}

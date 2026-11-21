"use client";

import { Copy, Inbox, MessageCircle, Printer, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { resetJoinLink } from "@/actions/join";
import { BackLink } from "@/components/patterns/back-link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";

export function JoinShare({
  link,
  qrSvg,
  libraryName,
  pending,
  canReset,
}: {
  link: string;
  qrSvg: string;
  libraryName: string;
  pending: number;
  canReset: boolean;
}) {
  const t = useTranslations("joinShare");
  const tm = useTranslations("more");
  const ta = useTranslations("admit");
  const tr = useTranslations("requests");
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, start] = useTransition();
  const share = `https://wa.me/?text=${encodeURIComponent(t("shareText", { library: libraryName, link }))}`;

  return (
    <div className="pb-6">
      <div className="pt-4 print:hidden lg:pt-8">
        <BackLink href="/more">{tm("title")}</BackLink>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-base text-text-2">{t("intro")}</p>
      </div>

      {/* The poster: this card is all that prints. */}
      <section className="poster mx-auto mt-5 max-w-sm rounded-[20px] border border-border bg-white p-6 text-center text-[#1a1a2e] print:mt-0 print:max-w-none print:border-0">
        <p className="text-lg font-semibold">{libraryName}</p>
        <h2 className="mt-1 text-[28px] leading-9 font-bold">{t("posterTitle")}</h2>
        <div className="mx-auto mt-4 w-full max-w-[260px] print:max-w-[420px]" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        <p className="mt-3 text-base font-medium">{t("posterBody")}</p>
        <p className="mt-2 text-xs break-all text-[#555]">{link}</p>
      </section>

      <div className="mx-auto mt-5 grid max-w-sm gap-2 print:hidden">
        <Button size="lg" onClick={() => window.print()}>
          <Printer aria-hidden />
          {t("print")}
        </Button>
        <a href={share} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "success", size: "lg" })}>
          <MessageCircle aria-hidden />
          {t("share")}
        </a>
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              toast(t("copied"));
            } catch {
              toast(link);
            }
          }}
        >
          <Copy aria-hidden />
          {t("copy")}
        </Button>
        <Link href="/students/requests" className={buttonVariants({ variant: "soft" })}>
          <Inbox aria-hidden />
          {tr("title")}
          {pending > 0 ? <span className="rounded-full bg-brand px-2 text-sm text-brand-fg tabular">{pending}</span> : null}
        </Link>
        {canReset ? (
          <Button variant="ghost" className="text-text-2" onClick={() => setConfirm(true)}>
            <RefreshCw aria-hidden />
            {t("reset")}
          </Button>
        ) : null}
      </div>

      <Sheet
        open={confirm}
        onOpenChange={setConfirm}
        title={t("reset")}
        description={t("resetHint")}
        closeLabel={ta("close")}
        footer={
          <Button
            variant="danger"
            size="lg"
            block
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await resetJoinLink();
                setConfirm(false);
                if (!res.ok) return void toast(tr("errFailed"), { tone: "error" });
                toast(t("resetDone"));
                router.refresh();
              })
            }
          >
            {t("resetConfirm")}
          </Button>
        }
      >
        <span />
      </Sheet>
    </div>
  );
}

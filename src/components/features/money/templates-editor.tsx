"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { saveTemplate } from "@/actions/fees";
import { BackLink } from "@/components/patterns/back-link";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { toast } from "@/components/ui/toast";
import { DEFAULT_TEMPLATES, fillTemplate, type TemplateKey } from "@/lib/templates";

const ORDER: TemplateKey[] = ["reminder", "overdue", "expiring", "welcome", "receipt"];
const ALL_VARS = ["name", "amount", "due_date", "end_date", "seat", "upi_link", "library", "receipt_link"] as const;
const VARS: Record<TemplateKey, string[]> = {
  reminder: ["name", "amount", "due_date", "upi_link", "library"],
  overdue: ["name", "amount", "seat", "upi_link", "library"],
  expiring: ["name", "end_date", "seat", "amount", "upi_link"],
  welcome: ["name", "library", "seat", "end_date"],
  receipt: ["name", "amount", "receipt_link", "library"],
};

export function TemplatesEditor({ initial, libraryName }: { initial: Record<"hi" | "en", Record<TemplateKey, string>>; libraryName: string }) {
  const t = useTranslations("templates");
  const tm = useTranslations("more");
  const uiLocale = useLocale() as "hi" | "en";
  const [lang, setLang] = useState<"hi" | "en">(uiLocale);
  return (
    <div className="pb-6">
      <div className="pt-4 lg:pt-8">
        <BackLink href="/more">{tm("title")}</BackLink>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-base text-text-2">{t("intro")}</p>
      </div>
      <Segmented
        className="mt-4"
        label="Language"
        value={lang}
        onChange={setLang}
        options={[
          { value: "hi", label: "हिंदी" },
          { value: "en", label: "English" },
        ]}
      />
      <div className="mt-4 space-y-4">
        {ORDER.map((k) => (
          <TemplateCard key={`${lang}-${k}`} k={k} lang={lang} initial={initial[lang][k]} libraryName={libraryName} />
        ))}
      </div>
    </div>
  );
}

function TemplateCard({ k, lang, initial, libraryName }: { k: TemplateKey; lang: "hi" | "en"; initial: string; libraryName: string }) {
  const t = useTranslations("templates");
  // Shown as [नाम] / [रकम] instead of {name} / {amount}; stored as {name}.
  const label = (v: string) => `[${t(`v_${v}` as "v_name")}]`;
  const toFriendly = (text: string) => ALL_VARS.reduce((acc, v) => acc.replaceAll(`{${v}}`, label(v)), text);
  const toStored = (text: string) => ALL_VARS.reduce((acc, v) => acc.replaceAll(label(v), `{${v}}`), text);
  const [body, setBody] = useState(() => toFriendly(initial));
  const [saved, setSaved] = useState(() => toFriendly(initial));
  const [pending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const original = toFriendly(DEFAULT_TEMPLATES.find((x) => x.key === k && x.locale === lang)?.body ?? "");

  function insert(v: string) {
    const el = ref.current;
    const token = label(v);
    if (!el) return setBody((b) => b + token);
    const s = el.selectionStart ?? body.length;
    const e = el.selectionEnd ?? body.length;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  }

  const preview = fillTemplate(toStored(body), {
    name: lang === "hi" ? "राहुल" : "Rahul",
    amount: "₹600",
    due_date: lang === "hi" ? "5 दिसंबर" : "5 Dec",
    end_date: lang === "hi" ? "4 जनवरी" : "4 Jan",
    seat: "A12",
    upi_link: "https://…/p/…",
    receipt_link: "https://…/r/…",
    library: libraryName,
  });

  return (
    <section className="rounded-[14px] border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{t(`k_${k}`)}</h2>
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        aria-label={t(`k_${k}`)}
        className="mt-2 w-full rounded-[12px] border border-border-strong bg-surface p-3 text-base focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-text-2">{t("insert")}</span>
        {VARS[k].map((v) => (
          <button key={v} type="button" onClick={() => insert(v)} className="h-9 rounded-full border border-border-strong bg-surface-2 px-3 text-sm font-medium">
            + {t(`v_${v}` as "v_name")}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm font-semibold text-text-2">{t("preview")}</p>
      <p className="mt-1 rounded-[12px] rounded-tl-none bg-[#dcf8c6] px-3 py-2 text-[15px] whitespace-pre-wrap text-[#111b21]">{preview}</p>
      <div className="mt-3 flex gap-2">
        <Button
          disabled={pending || body.trim() === saved.trim() || !body.trim()}
          onClick={() =>
            start(async () => {
              const res = await saveTemplate(k, lang, toStored(body));
              if (!res.ok) return void toast(t("failed"), { tone: "error" });
              setSaved(body);
              toast(t("saved"));
            })
          }
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("save")}
        </Button>
        {body !== original ? (
          <Button variant="ghost" onClick={() => setBody(original)}>
            <RotateCcw aria-hidden />
            {t("reset")}
          </Button>
        ) : null}
      </div>
    </section>
  );
}

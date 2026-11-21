"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore, useTransition } from "react";
import { feedbackOn, paymentFeedback, setFeedback } from "@/lib/client/feedback";
import { setActiveLibrary, setLocale, setTheme } from "@/actions/preferences";
import { Segmented } from "@/components/ui/segmented";
import type { ThemePref } from "@/lib/theme";

export function LanguageSwitch() {
  const t = useTranslations("more");
  const locale = useLocale();
  const router = useRouter();
  const [value, setValue] = useState(locale);
  const [, start] = useTransition();
  return (
    <Segmented
      label={t("language")}
      value={value}
      onChange={(v) => {
        setValue(v);
        start(async () => {
          await setLocale(v);
          router.refresh();
        });
      }}
      options={[
        { value: "hi", label: "हिंदी" },
        { value: "en", label: "English" },
      ]}
    />
  );
}

export function ThemeSwitch({ initial }: { initial: ThemePref }) {
  const t = useTranslations("more");
  const [value, setValue] = useState<ThemePref>(initial);
  const [, start] = useTransition();
  return (
    <Segmented
      label={t("theme")}
      value={value}
      onChange={(v) => {
        setValue(v);
        // Change instantly; the server remembers it for next time.
        if (v === "system") delete document.documentElement.dataset.theme;
        else document.documentElement.dataset.theme = v;
        start(() => setTheme(v));
      }}
      options={[
        { value: "system", label: t("themeSystem") },
        { value: "light", label: t("themeLight") },
        { value: "dark", label: t("themeDark") },
      ]}
    />
  );
}

const noop = () => () => {};

/** Buzz + soft tick when money is received. Off by default. */
export function FeedbackSwitch() {
  const t = useTranslations("more");
  const stored = useSyncExternalStore(
    noop,
    () => (feedbackOn() ? "on" : "off"),
    () => "off" as const,
  );
  const [choice, setValue] = useState<"off" | "on" | null>(null);
  const value = choice ?? stored;
  return (
    <Segmented
      label={t("payFeedback")}
      value={value}
      onChange={(v) => {
        setValue(v);
        setFeedback(v === "on");
        if (v === "on") paymentFeedback(true);
      }}
      options={[
        { value: "off", label: t("off") },
        { value: "on", label: t("on") },
      ]}
    />
  );
}

export function LibrarySwitch({ current, options }: { current: string; options: { id: string; name: string }[] }) {
  const t = useTranslations("more");
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [, start] = useTransition();
  return (
    <Segmented
      label={t("switchLibrary")}
      value={value}
      onChange={(v) => {
        setValue(v);
        start(async () => {
          await setActiveLibrary(v);
          router.refresh();
        });
      }}
      options={options.map((o) => ({ value: o.id, label: o.name }))}
    />
  );
}

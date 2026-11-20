"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { createLibrary } from "@/actions/setup";
import { Input } from "@/components/ui/input";
import { Field, StepShell } from "./step-shell";

export function LibraryStep() {
  const t = useTranslations("setup");
  const router = useRouter();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <StepShell
      step={1}
      title={t("libraryTitle")}
      pending={pending}
      error={error}
      canSave={name.trim().length > 0}
      hideSkip
      saveLabel={t("createLibrary")}
      onSave={() =>
        start(async () => {
          const res = await createLibrary({ name, city, ownerName: owner });
          if (!res.ok) return setError(t("errFailed"));
          router.push("/setup/seats");
        })
      }
    >
      <div className="space-y-5">
        <Field label={t("libraryName")} htmlFor="lib-name">
          <Input id="lib-name" autoFocus placeholder={t("libraryNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("city")} htmlFor="lib-city">
          <Input id="lib-city" placeholder={t("cityPlaceholder")} value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <Field label={t("yourName")} htmlFor="lib-owner">
          <Input id="lib-owner" placeholder={t("yourNamePlaceholder")} value={owner} onChange={(e) => setOwner(e.target.value)} />
        </Field>
      </div>
    </StepShell>
  );
}

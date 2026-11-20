"use client";

import { Trash2, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { addStaff, finishSetup, removeStaff } from "@/actions/setup";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { formatMobile } from "@/lib/phone";
import { Field, StepShell } from "./step-shell";

export type StaffRow = { id: string; name: string; phone: string; role: "owner" | "manager" | "desk"; linked: boolean; isMe: boolean };

export function StaffStep({ staff }: { staff: StaffRow[] }) {
  const t = useTranslations("setup");
  const ta = useTranslations("admit");
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<"manager" | "desk">("desk");
  const [earnings, setEarnings] = useState<"yes" | "no">("no");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setError(null);
    start(async () => {
      const res = await addStaff({ name, phone, kind, canSeeEarnings: earnings === "yes" });
      if (!res.ok) return setError(res.error === "exists" ? t("staffExists") : res.error === "invalid" ? t("invalidPhone") : t("errFailed"));
      toast(t("staffAdded", { name }));
      setName("");
      setPhone("");
      router.refresh();
    });
  }

  return (
    <StepShell
      step={6}
      title={t("staffTitle")}
      hint={t("staffHint")}
      pending={pending}
      error={error}
      saveLabel={t("finish")}
      hideSkip
      onSave={() =>
        start(async () => {
          const res = await finishSetup();
          if (!res.ok) return setError(t("errFailed"));
          router.push("/setup/done");
        })
      }
    >
      <ul className="mb-5 divide-y divide-border rounded-[14px] border border-border bg-surface">
        {staff.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar name={s.name} className="size-10 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{s.isMe ? t("staffYou") : s.name}</p>
              <p className="text-sm text-text-2 tabular">
                {formatMobile(s.phone)}
                {!s.linked ? ` · ${t("staffWaiting")}` : ""}
              </p>
            </div>
            {s.role !== "owner" ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await removeStaff(s.id);
                    if (!res.ok) return setError(t("errFailed"));
                    router.refresh();
                  })
                }
              >
                <Trash2 aria-hidden />
                {t("removeStaff")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <Card className="space-y-4 p-4">
        <Field label={t("staffName")} htmlFor="staff-name">
          <Input id="staff-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("staffPhone")} htmlFor="staff-phone">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base font-medium text-text-2">+91</span>
            <Input id="staff-phone" inputMode="numeric" className="h-12 pl-14 text-base tabular" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(-10))} />
          </div>
        </Field>
        <Field label={t("staffKind")}>
          <ChoiceGroup
            label={t("staffKind")}
            columns={1}
            value={kind}
            onChange={setKind}
            options={[
              { value: "desk", label: t("kindDesk"), hint: t("kindDeskHint") },
              { value: "manager", label: t("kindManager"), hint: t("kindManagerHint") },
            ]}
          />
        </Field>
        <Field label={t("canSeeEarnings")}>
          <ChoiceGroup
            label={t("canSeeEarnings")}
            value={earnings}
            onChange={setEarnings}
            options={[
              { value: "no", label: ta("no") },
              { value: "yes", label: ta("yes") },
            ]}
          />
        </Field>
        <Button variant="soft" block disabled={pending || !name.trim() || phone.length !== 10} onClick={add}>
          <UserPlus aria-hidden />
          {t("addStaff")}
        </Button>
      </Card>
    </StepShell>
  );
}

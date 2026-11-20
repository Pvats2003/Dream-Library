"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { savePlans } from "@/actions/setup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyInput } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { Field, StepShell } from "./step-shell";

export type PlanDraft = { id: string | null; key: string; name: string; shiftId: string; months: number; pricePaise: number | null };

export function PlansStep({ initial, shifts }: { initial: PlanDraft[]; shifts: { id: string; name: string }[] }) {
  const t = useTranslations("setup");
  const router = useRouter();
  const [plans, setPlans] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const update = (key: string, patch: Partial<PlanDraft>) => setPlans((p) => p.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const shiftName = (id: string) => shifts.find((s) => s.id === id)?.name ?? "";

  function save() {
    setError(null);
    start(async () => {
      const res = await savePlans(
        plans.map((p) => ({ id: p.id, name: p.name.trim() || t("planNameAuto", { shift: shiftName(p.shiftId), months: p.months }), shiftId: p.shiftId, months: p.months, pricePaise: p.pricePaise ?? 0 })),
      );
      if (!res.ok) return setError(t("errFailed"));
      if (res.warning) toast(t("errInUse"));
      router.push("/setup/payments");
    });
  }

  return (
    <StepShell step={4} title={t("plansTitle")} hint={t("plansHint")} pending={pending} error={error} onSave={save} canSave={plans.length > 0 && shifts.length > 0}>
      <div className="space-y-3">
        {plans.map((p) => (
          <Card key={p.key} className="space-y-3 p-4">
            <Field label={t("planName")} htmlFor={`pn-${p.key}`}>
              <Input
                id={`pn-${p.key}`}
                className="h-12 text-base"
                placeholder={t("planNameAuto", { shift: shiftName(p.shiftId), months: p.months })}
                value={p.name}
                onChange={(e) => update(p.key, { name: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("planShift")} htmlFor={`ps-${p.key}`}>
                <select
                  id={`ps-${p.key}`}
                  value={p.shiftId}
                  onChange={(e) => update(p.key, { shiftId: e.target.value })}
                  className="h-12 w-full rounded-[12px] border border-border-strong bg-surface px-3 text-base"
                >
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("planMonths")} htmlFor={`pm-${p.key}`}>
                <select
                  id={`pm-${p.key}`}
                  value={p.months}
                  onChange={(e) => update(p.key, { months: Number(e.target.value) })}
                  className="h-12 w-full rounded-[12px] border border-border-strong bg-surface px-3 text-base"
                >
                  {[1, 2, 3, 6, 12].map((n) => (
                    <option key={n} value={n}>
                      {t("monthsN", { n })}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label={t("price")} htmlFor={`pp-${p.key}`}>
              <MoneyInput id={`pp-${p.key}`} valuePaise={p.pricePaise} onChange={(v) => update(p.key, { pricePaise: v })} />
            </Field>
            {plans.length > 1 ? (
              <Button variant="ghost" size="sm" className="text-danger" onClick={() => setPlans((x) => x.filter((y) => y.key !== p.key))}>
                <Trash2 aria-hidden />
                {t("removePlan")}
              </Button>
            ) : null}
          </Card>
        ))}
        {shifts.length > 0 ? (
          <Button
            variant="secondary"
            block
            onClick={() => setPlans((x) => [...x, { id: null, key: crypto.randomUUID(), name: "", shiftId: shifts[0].id, months: 1, pricePaise: null }])}
          >
            <Plus aria-hidden />
            {t("addPlan")}
          </Button>
        ) : null}
      </div>
    </StepShell>
  );
}

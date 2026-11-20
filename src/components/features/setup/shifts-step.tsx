"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { saveShifts } from "@/actions/setup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { hhmmToMinutes, minutesToHHMM } from "@/lib/dates";
import { Field, StepShell } from "./step-shell";

export type ShiftDraft = { id: string | null; key: string; name: string; start: string; end: string; isFullDay: boolean };

export function ShiftsStep({ initial }: { initial: ShiftDraft[] }) {
  const t = useTranslations("setup");
  const router = useRouter();
  const [shifts, setShifts] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const update = (key: string, patch: Partial<ShiftDraft>) => setShifts((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const valid = (s: ShiftDraft) => {
    try {
      return hhmmToMinutes(s.end) > hhmmToMinutes(s.start);
    } catch {
      return false;
    }
  };
  const open = Math.min(...shifts.filter(valid).map((s) => hhmmToMinutes(s.start)), 1440);
  const close = Math.max(...shifts.filter(valid).map((s) => hhmmToMinutes(s.end)), 0);

  function save() {
    setError(null);
    if (shifts.some((s) => !valid(s))) return setError(t("shiftTimeError"));
    start(async () => {
      const res = await saveShifts(
        shifts.map((s) => ({ id: s.id, name: s.name, startMin: hhmmToMinutes(s.start), endMin: hhmmToMinutes(s.end), isFullDay: s.isFullDay })),
      );
      if (!res.ok) return setError(t("errFailed"));
      if (res.warning) toast(t("errInUse"));
      router.push("/setup/plans");
    });
  }

  return (
    <StepShell step={3} title={t("shiftsTitle")} hint={t("shiftsHint")} pending={pending} error={error} onSave={save} canSave={shifts.length > 0}>
      {/* Timeline: each shift as a bar across the opening hours. */}
      {close > open ? (
        <div className="mb-5 space-y-1.5 rounded-[14px] bg-surface-2 p-3" aria-hidden>
          {shifts.filter(valid).map((s) => {
            const a = hhmmToMinutes(s.start);
            const b = hhmmToMinutes(s.end);
            return (
              <div key={s.key} className="relative h-7">
                <div
                  className={cn("absolute inset-y-0 flex items-center rounded-[8px] px-2 text-xs font-semibold whitespace-nowrap", s.isFullDay ? "bg-brand/25 text-brand-soft-fg" : "bg-brand text-brand-fg")}
                  style={{ left: `${((a - open) / (close - open)) * 100}%`, width: `${((b - a) / (close - open)) * 100}%` }}
                >
                  {s.name}
                </div>
              </div>
            );
          })}
          <div className="flex justify-between text-xs text-text-3 tabular">
            <span>{minutesToHHMM(open)}</span>
            <span>{minutesToHHMM(close)}</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {shifts.map((s) => (
          <Card key={s.key} className="p-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
              <Field label={t("shiftName")} htmlFor={`sn-${s.key}`}>
                <Input id={`sn-${s.key}`} className="h-12 text-base" value={s.name} onChange={(e) => update(s.key, { name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:contents">
                <Field label={t("from")} htmlFor={`sf-${s.key}`}>
                  <Input id={`sf-${s.key}`} type="time" className="h-12 text-base tabular" value={s.start} onChange={(e) => update(s.key, { start: e.target.value })} />
                </Field>
                <Field label={t("to")} htmlFor={`st-${s.key}`}>
                  <Input
                    id={`st-${s.key}`}
                    type="time"
                    className="h-12 text-base tabular"
                    value={s.end === "24:00" ? "23:59" : s.end}
                    onChange={(e) => update(s.key, { end: e.target.value })}
                    aria-invalid={!valid(s)}
                  />
                </Field>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <label className="flex h-11 items-center gap-2 text-base font-medium">
                <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={s.isFullDay} onChange={(e) => update(s.key, { isFullDay: e.target.checked })} />
                {t("fullDay")}
              </label>
              {shifts.length > 1 ? (
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => setShifts((x) => x.filter((y) => y.key !== s.key))}>
                  <Trash2 aria-hidden />
                  {t("removeShift")}
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
        <Button
          variant="secondary"
          block
          onClick={() => setShifts((x) => [...x, { id: null, key: crypto.randomUUID(), name: "", start: "09:00", end: "13:00", isFullDay: false }])}
        >
          <Plus aria-hidden />
          {t("addShift")}
        </Button>
      </div>
    </StepShell>
  );
}

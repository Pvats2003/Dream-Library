"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { saveLayout } from "@/actions/setup";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { MAX_COLS, MAX_ROWS, cellKey, duplicateLabels, generateSeats, toLayoutPayload, totalSeats, type ZoneDraft } from "@/lib/layout";
import { Field, Stepper, StepShell } from "./step-shell";

export function LayoutBuilder({ initial, nextHref }: { initial: ZoneDraft[]; nextHref: string }) {
  const t = useTranslations("setup");
  const router = useRouter();
  const [zones, setZones] = useState<ZoneDraft[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const dups = useMemo(() => duplicateLabels(zones), [zones]);
  const update = (key: string, patch: Partial<ZoneDraft>) => setZones((zs) => zs.map((z) => (z.key === key ? { ...z, ...patch } : z)));

  function addZone() {
    const usedLetters = new Set(zones.map((z) => z.prefix[0]));
    const letter = "GHJKLMNPQRSTUVWXYZ".split("").find((l) => !usedLetters.has(l)) ?? "Z";
    setZones((zs) => [
      ...zs,
      {
        key: crypto.randomUUID(),
        name: t("newZoneName", { n: zs.length + 1 }),
        rows: 2,
        cols: 6,
        aisleAfter: null,
        labelStyle: "prefix",
        prefix: letter,
        removed: [],
        girlsOnly: false,
        ac: true,
        cabin: false,
      },
    ]);
  }

  function save() {
    setError(null);
    if (zones.some((z) => !z.name.trim())) return setError(t("zoneNameRequired"));
    if (dups.length) return setError(t("dupLabels", { labels: dups.slice(0, 5).join(", ") }));
    start(async () => {
      const res = await saveLayout(toLayoutPayload(zones));
      if (!res.ok) return setError(t("errFailed"));
      toast(t("totalSeats", { count: totalSeats(zones) }));
      router.push(nextHref);
    });
  }

  return (
    <StepShell step={2} title={t("seatsTitle")} hint={t("seatsHint")} pending={pending} error={error} onSave={save}>
      <div className="space-y-5">
        {zones.map((z) => (
          <ZoneCard key={z.key} z={z} update={(p) => update(z.key, p)} onRemove={zones.length > 1 ? () => setZones((zs) => zs.filter((x) => x.key !== z.key)) : undefined} />
        ))}
        <Button variant="secondary" block onClick={addZone}>
          <Plus aria-hidden />
          {t("addZone")}
        </Button>
        <p className="text-center text-lg font-semibold tabular">{t("totalSeats", { count: totalSeats(zones) })}</p>
      </div>
    </StepShell>
  );
}

function ZoneCard({ z, update, onRemove }: { z: ZoneDraft; update: (p: Partial<ZoneDraft>) => void; onRemove?: () => void }) {
  const t = useTranslations("setup");
  const seats = useMemo(() => generateSeats(z), [z]);
  const byCell = new Map(seats.map((s) => [cellKey(s.row, s.col), s]));
  const removed = new Set(z.removed);
  const cols = Math.min(MAX_COLS, z.cols);
  const template = Array.from({ length: cols + (z.aisleAfter ? 1 : 0) }, (_, i) =>
    z.aisleAfter && i === z.aisleAfter ? "8px" : "minmax(0, 1fr)",
  ).join(" ");

  const toggle = (k: string) => update({ removed: removed.has(k) ? z.removed.filter((x) => x !== k) : [...z.removed, k] });

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <Field label={t("zoneName")} htmlFor={`zn-${z.key}`}>
          <Input id={`zn-${z.key}`} className="h-12 text-base" value={z.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("rows")}>
            <Stepper label={t("rows")} value={z.rows} min={1} max={MAX_ROWS} onChange={(rows) => update({ rows })} />
          </Field>
          <Field label={t("cols")}>
            <Stepper
              label={t("cols")}
              value={z.cols}
              min={1}
              max={MAX_COLS}
              onChange={(c) => update({ cols: c, aisleAfter: z.aisleAfter !== null && z.aisleAfter >= c ? null : z.aisleAfter })}
            />
          </Field>
        </div>
        <Field label={t("aisle")} htmlFor={`aisle-${z.key}`}>
          <select
            id={`aisle-${z.key}`}
            value={z.aisleAfter ?? 0}
            onChange={(e) => update({ aisleAfter: Number(e.target.value) || null })}
            className="h-12 w-full rounded-[12px] border border-border-strong bg-surface px-3 text-base"
          >
            <option value={0}>{t("noAisle")}</option>
            {Array.from({ length: Math.max(0, z.cols - 1) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("labels")}>
          <ChoiceGroup
            label={t("labels")}
            columns={1}
            value={z.labelStyle}
            onChange={(labelStyle) => update({ labelStyle })}
            options={[
              { value: "rows", label: t("labelRows") },
              { value: "prefix", label: t("labelPrefix") },
            ]}
          />
        </Field>
        <Field label={z.labelStyle === "rows" ? t("firstLetter") : t("prefix")} htmlFor={`pf-${z.key}`}>
          <Input
            id={`pf-${z.key}`}
            className="h-12 w-28 text-center text-lg font-semibold uppercase"
            maxLength={z.labelStyle === "rows" ? 1 : 3}
            value={z.prefix}
            onChange={(e) => update({ prefix: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["girlsOnly", t("girlsOnly")],
              ["ac", t("ac")],
              ["cabin", t("cabin")],
            ] as const
          ).map(([k, label]) => (
            <label
              key={k}
              className={cn(
                "flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                z[k] ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border-strong bg-surface text-text-2",
              )}
            >
              <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={z[k]} onChange={(e) => update({ [k]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-sm text-text-3">{t("tapToRemove")}</p>
            <p className="text-sm font-semibold tabular">{t("seatCount", { count: seats.length })}</p>
          </div>
          <div className="rounded-[12px] bg-surface-2 p-2">
            <div className="grid gap-1" style={{ gridTemplateColumns: template, maxWidth: cols * 46 }}>
              {Array.from({ length: Math.min(MAX_ROWS, z.rows) }, (_, r) =>
                Array.from({ length: cols }, (_, c) => {
                  const k = cellKey(r, c);
                  const s = byCell.get(k);
                  const x = z.aisleAfter && c >= z.aisleAfter ? c + 1 : c;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggle(k)}
                      aria-pressed={!removed.has(k)}
                      aria-label={s ? s.label : `${r + 1}-${c + 1}`}
                      style={{ gridColumnStart: x + 1, gridRowStart: r + 1 }}
                      className={cn(
                        "grid aspect-square min-w-0 place-items-center overflow-hidden rounded-[6px] text-[10px] font-bold tabular sm:text-xs",
                        s ? "bg-brand text-brand-fg" : "border border-dashed border-border-strong bg-transparent text-transparent",
                      )}
                    >
                      {s?.label ?? "·"}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
        </div>

        {onRemove ? (
          <Button variant="ghost" className="text-danger" onClick={onRemove}>
            <Trash2 aria-hidden />
            {t("removeZone")}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

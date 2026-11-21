"use client";

import { CircleCheck, IndianRupee, Inbox, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { LanguageSwitch, ThemeSwitch } from "@/components/features/preferences";
import { SeatTile } from "@/components/features/seats/seat-tile";
import { EmptyState } from "@/components/patterns/empty-state";
import { ShiftRing } from "@/components/patterns/shift-ring";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup, MoneyInput } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-pill";
import { ToastPreview, Toaster, toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { ThemePref } from "@/lib/theme";

/** One page that shows every token and every part in every state. */
export function DesignLab({ theme }: { theme: ThemePref }) {
  const t = useTranslations("lab");
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-5xl px-4 pt-6 pb-16 sm:px-8 lg:pt-10">
        <header className="flex flex-col gap-5 pb-2 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <LogoMark />
            <div>
              <h1 className="font-display text-3xl tracking-tight">{t("title")}</h1>
              <p className="mt-1 max-w-xl text-base text-text-2">{t("intro")}</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:w-[420px]" aria-label={t("controls")}>
            <LanguageSwitch />
            <ThemeSwitch initial={theme} />
          </div>
        </header>

        <Colors />
        <Typography />
        <Layout />
        <Components />

        <p className="mt-12 text-center text-sm text-text-3">{t("footer")}</p>
      </div>
      <Toaster />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-14 border-t border-border pt-8">
      <h2 className="mb-6 text-2xl font-bold tracking-tight">{title}</h2>
      <div className="space-y-8">{children}</div>
    </section>
  );
}

function Sub({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-text-2">{title}</h3>
      {hint ? <p className="mt-0.5 text-sm text-text-3">{hint}</p> : null}
      <div className="mt-3">{children}</div>
    </div>
  );
}

/** A colour chip. `label` is shown as written. */
function Swatch({ label, bg, fg, border }: { label: string; bg: string; fg?: string; border?: boolean }) {
  return (
    <div className="min-w-0">
      <div
        className={cn("flex h-16 items-end rounded-[12px] p-2 text-sm font-semibold tabular", border && "border border-border")}
        style={{ background: `var(--${bg})`, color: fg ? `var(--${fg})` : undefined }}
      >
        {fg ? "₹600" : null}
      </div>
      <p className="mt-1.5 truncate font-mono text-xs text-text-2">{label}</p>
    </div>
  );
}

function Colors() {
  const t = useTranslations("lab");
  const statuses = [
    { key: "paid", pill: "paid" as const, label: t("pill_paid") },
    { key: "due-soon", pill: "due" as const, label: t("pill_due") },
    { key: "overdue", pill: "overdue" as const, label: t("pill_overdue") },
    { key: "upcoming", pill: "upcoming" as const, label: t("pill_upcoming") },
    { key: "free", pill: "free" as const, label: t("pill_free") },
  ];
  return (
    <Section title={t("s_colors")}>
      <Sub title={t("s_neutral")}>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-12">
          {Array.from({ length: 12 }, (_, i) => (
            <Swatch key={i} label={`--n-${i + 1}`} bg={`n-${i + 1}`} border={i < 3} />
          ))}
        </div>
      </Sub>
      <Sub title={t("s_brand")}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Swatch label="--brand" bg="brand" fg="brand-fg" />
          <Swatch label="--brand-hover" bg="brand-hover" fg="brand-fg" />
          <Swatch label="--brand-press" bg="brand-press" fg="brand-fg" />
          <Swatch label="--brand-soft" bg="brand-soft" fg="brand-soft-fg" />
          <Swatch label="--focus" bg="focus" />
          <Swatch label="brand on surface" bg="surface" fg="brand" border />
        </div>
      </Sub>
      <Sub title={t("s_accent")}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Swatch label="--accent" bg="accent" />
          <Swatch label="--accent-soft" bg="accent-soft" fg="accent-fg" />
        </div>
      </Sub>
      <Sub title={t("s_status")}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {statuses.map((s) => (
            <div key={s.key} className="rounded-[14px] border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <StatusPill status={s.pill} label={s.label} />
                <span className="font-mono text-xs text-text-3">--{s.key}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Swatch label="solid" bg={s.key} fg={s.key === "free" ? undefined : "on-solid"} />
                <Swatch label="soft" bg={`${s.key}-soft`} fg={`${s.key}-fg`} border />
                <Swatch label="fg" bg={`${s.key}-fg`} />
              </div>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title={t("s_roles")}>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          <Swatch label="--bg" bg="bg" fg="text" border />
          <Swatch label="--surface" bg="surface" fg="text" border />
          <Swatch label="--surface-2" bg="surface-2" fg="text-2" border />
          <Swatch label="--surface-3" bg="surface-3" fg="text-2" />
          <Swatch label="--border-input" bg="border-input" />
          <Swatch label="--text-3" bg="surface" fg="text-3" border />
        </div>
      </Sub>
    </Section>
  );
}

function Typography() {
  const t = useTranslations("lab");
  const sizes = [
    ["text-3xl", 40],
    ["text-2xl", 32],
    ["text-xl", 24],
    ["text-lg", 20],
    ["text-base", 17],
    ["text-sm", 15],
    ["text-xs", 13],
  ] as const;
  return (
    <Section title={t("s_type")}>
      <Sub title={t("s_display")}>
        <Card className="p-5">
          <p className="font-display text-[32px] leading-[1.25] sm:text-[40px] tracking-tight" lang="hi">
            {t("sample_greeting")}
          </p>
          <p className="font-display text-[32px] leading-[1.25] sm:text-[40px] tracking-tight" lang="en">
            Namaste, Rajesh ji
          </p>
          <p className="mt-3 font-display text-2xl text-brand">
            {t("sample_receiptTitle")} · <span lang="en">Fee receipt</span>
          </p>
        </Card>
      </Sub>
      <Sub title={t("s_scale")}>
        <Card className="divide-y divide-border">
          {sizes.map(([cls, px]) => (
            <div key={cls} className="flex items-baseline gap-4 px-4 py-3">
              <span className="w-12 shrink-0 font-mono text-xs text-text-3 tabular">{px}px</span>
              <p className={cn(cls, "min-w-0 text-pretty", px >= 24 && "font-bold tracking-tight")}>{t("sample_pangram")}</p>
            </div>
          ))}
        </Card>
      </Sub>
      <Sub title={t("s_baseline")} hint={t("baselineHint")}>
        <Card className="space-y-4 p-5">
          {["text-2xl font-bold sm:text-3xl", "text-xl font-semibold", "text-base"].map((cls) => (
            <p key={cls} className={cn(cls, "w-fit border-b border-dashed border-focus leading-[1.6]")}>
              {t("sample_mixed")}
            </p>
          ))}
        </Card>
      </Sub>
      <Sub title={t("s_conjuncts")}>
        <Card className="space-y-3 p-5" lang="hi">
          <p className="text-3xl font-semibold">{t("sample_conjuncts")}</p>
          <p className="text-2xl">{t("sample_matras")}</p>
          <p className="text-lg">{t("sample_sentence")}</p>
          <p className="font-display text-2xl">{t("sample_sentence")}</p>
          <p className="text-sm text-text-2">{t("sample_sentence")}</p>
        </Card>
      </Sub>
      <Sub title={t("s_numbers")}>
        <Card className="w-full max-w-xs p-5">
          {["₹600", "₹1,200", "₹12,500", "₹1,20,000", "₹1,00,00,000"].map((n) => (
            <p key={n} className="text-right text-2xl font-bold tabular">
              {n}
            </p>
          ))}
        </Card>
      </Sub>
    </Section>
  );
}

function Layout() {
  const t = useTranslations("lab");
  const tc = useTranslations("admit");
  const [open, setOpen] = useState(false);
  return (
    <Section title={t("s_layout")}>
      <Sub title={t("s_spacing")}>
        <div className="flex flex-wrap items-end gap-4">
          {[4, 8, 12, 16, 24, 32, 48].map((n) => (
            <div key={n} className="text-center">
              <div className="rounded-[4px] bg-brand-soft" style={{ width: n, height: n }} />
              <p className="mt-1 font-mono text-xs text-text-3">{n}</p>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title={t("s_radius")}>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["input", 10],
              ["button", 12],
              ["card", 14],
              ["sheet", 20],
              ["pill", 999],
            ] as const
          ).map(([n, r]) => (
            <div key={n} className="text-center">
              <div className="h-16 w-24 border-2 border-brand bg-surface" style={{ borderRadius: r }} />
              <p className="mt-1 font-mono text-xs text-text-3">{n}</p>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title={t("s_elevation")}>
        <div className="flex flex-wrap gap-6">
          {(["shadow-sm", "shadow-pop", "shadow-sheet", "glow"] as const).map((s) => (
            <div key={s} className="text-center">
              <div className="h-20 w-32 rounded-[14px] border border-border bg-surface" style={{ boxShadow: `var(--${s})` }} />
              <p className="mt-2 font-mono text-xs text-text-3">--{s}</p>
            </div>
          ))}
        </div>
      </Sub>
      <Sub title={t("s_motion")} hint={t("motionHint")}>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            {t("openSheet")}
          </Button>
          <Button variant="secondary" onClick={() => toast(t("toastText"))}>
            {t("showToast")}
          </Button>
        </div>
        <Sheet open={open} onOpenChange={setOpen} title={t("sheetTitle")} description={t("sheetBody")} closeLabel={tc("close")}>
          <Button block size="lg" onClick={() => setOpen(false)}>
            {tc("next")}
          </Button>
        </Sheet>
      </Sub>
    </Section>
  );
}

const STATES = ["default", "hover", "focus", "pressed", "disabled", "loading"] as const;
const FORCE: Record<(typeof STATES)[number], string | undefined> = {
  default: undefined,
  hover: "hover",
  focus: "focus",
  pressed: "pressed",
  disabled: undefined,
  loading: undefined,
};

function StateCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      {children}
      <span className="text-xs text-text-3">{label}</span>
    </div>
  );
}

function Components() {
  const t = useTranslations("lab");
  const ts = useTranslations("seats");
  const [choice, setChoice] = useState<"a" | "b" | "c">("b");
  const [seg, setSeg] = useState("all");
  const [money, setMoney] = useState<number | null>(120000);
  const variants = [
    ["primary", t("v_primary")],
    ["secondary", t("v_secondary")],
    ["soft", t("v_soft")],
    ["ghost", t("v_ghost")],
    ["success", t("v_success")],
    ["danger", t("v_danger")],
  ] as const;

  return (
    <Section title={t("s_components")}>
      <Sub title={t("s_buttons")}>
        <div className="space-y-5">
          {variants.map(([v, label]) => (
            <div key={v} className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              {STATES.map((s) => (
                <StateCell key={s} label={t(`st_${s}`)}>
                  <Button variant={v} data-force={FORCE[s]} disabled={s === "disabled"} loading={s === "loading"} tabIndex={-1}>
                    {v === "success" ? <IndianRupee aria-hidden /> : null}
                    {label}
                  </Button>
                </StateCell>
              ))}
            </div>
          ))}
          <div className="grid gap-3 sm:grid-cols-3">
            <Button size="lg" block>
              {t("v_primary")} · 56px
            </Button>
            <Button size="md" variant="secondary" block>
              {t("v_secondary")} · 48px
            </Button>
            <Button size="sm" variant="ghost">
              {t("v_ghost")} · 40px
            </Button>
          </div>
        </div>
      </Sub>

      <Sub title={t("s_inputs")}>
        <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <StateCell label={t("st_default")}>
            <Input placeholder={t("namePh")} tabIndex={-1} />
          </StateCell>
          <StateCell label={t("st_hover")}>
            <Input placeholder={t("namePh")} data-force="hover" tabIndex={-1} />
          </StateCell>
          <StateCell label={t("st_focus")}>
            <Input defaultValue="Rahul Kumar" data-force="focus" tabIndex={-1} />
          </StateCell>
          <StateCell label={t("st_filled")}>
            <div className="relative w-full">
              <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-medium text-text-2 tabular">+91</span>
              <Input defaultValue="98765 43210" className="pl-14 tabular" tabIndex={-1} />
            </div>
          </StateCell>
          <StateCell label={t("st_error")}>
            <Input defaultValue="12345" aria-invalid tabIndex={-1} />
            <p className="text-sm font-medium text-danger">{t("errorText")}</p>
          </StateCell>
          <StateCell label={t("st_disabled")}>
            <Input defaultValue="Dream Library" disabled />
          </StateCell>
          <StateCell label={t("money")}>
            <MoneyInput id="lab-money" valuePaise={money} onChange={setMoney} />
          </StateCell>
          <StateCell label={t("select")}>
            <select className="h-12 w-full rounded-[12px] border border-border-input bg-surface px-3 text-base" defaultValue="m" aria-label={t("select")}>
              <option value="m">Morning Monthly · ₹600</option>
              <option value="f">Full Day Monthly · ₹1,200</option>
            </select>
          </StateCell>
          <StateCell label={t("st_default")}>
            <label className="flex h-12 items-center gap-3 text-base font-medium">
              <input type="checkbox" defaultChecked className="size-6 accent-[var(--brand)]" />
              {t("checkbox")}
            </label>
          </StateCell>
          <div className="sm:col-span-2 lg:col-span-3">
            <textarea
              rows={3}
              placeholder={t("textarea")}
              aria-label={t("textarea")}
              className="w-full rounded-[12px] border border-border-input bg-surface p-3 text-base focus:border-brand focus:ring-4 focus:ring-brand/20 focus:outline-none"
            />
          </div>
        </div>
      </Sub>

      <Sub title={t("s_choices")}>
        <ChoiceGroup
          label={t("s_choices")}
          columns={3}
          value={choice}
          onChange={setChoice}
          options={[
            { value: "a", label: t("optA") },
            { value: "b", label: t("optB") },
            { value: "c", label: t("optC") },
          ]}
        />
      </Sub>

      <Sub title={t("s_segmented")}>
        <Segmented
          label={t("s_segmented")}
          value={seg}
          onChange={setSeg}
          options={[
            { value: "all", label: ts("allShifts") },
            { value: "m", label: "Morning" },
            { value: "e", label: "Evening" },
            { value: "n", label: "Night" },
            { value: "f", label: "Full Day" },
          ]}
        />
      </Sub>

      <Sub title={t("s_pills")}>
        <div className="flex flex-wrap gap-2">
          <StatusPill status="paid" label={t("pill_paid")} />
          <StatusPill status="due" label={t("pill_due")} />
          <StatusPill status="overdue" label={t("pill_overdue")} />
          <StatusPill status="expiring" label={t("pill_expiring")} />
          <StatusPill status="upcoming" label={t("pill_upcoming")} />
          <StatusPill status="free" label={t("pill_free")} />
          <StatusPill status="paused" label={t("pill_paused")} />
          <StatusPill status="neutral" label="BPSC" />
        </div>
      </Sub>

      <Sub title={t("s_seats")}>
        <div className="flex flex-wrap gap-4">
          {(
            [
              ["free", "A1", t("pill_free")],
              ["taken", "A2", t("pill_paid")],
              ["expiring", "A3", t("pill_due")],
              ["overdue", "A4", t("pill_overdue")],
              ["inactive", "A5", t("pill_off")],
            ] as const
          ).map(([state, label, caption]) => (
            <div key={state} className="flex w-16 flex-col items-center gap-1.5">
              <SeatTile state={state} label={label} initials={state === "taken" || state === "expiring" || state === "overdue" ? "RK" : undefined} tabIndex={-1} />
              <span className="text-center text-sm text-text-2">{caption}</span>
            </div>
          ))}
        </div>
      </Sub>

      <Sub title={t("s_cards")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <span className="grid size-9 place-items-center rounded-full bg-success-soft text-success">
              <CircleCheck className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-medium text-text-2">{t("cardTitle")}</p>
            <p className="text-[32px] leading-10 font-bold tracking-tight tabular">₹3,600</p>
            <p className="text-sm text-text-2">{t("cardDetail")}</p>
          </Card>
          <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
            {["Rahul Kumar", "Priya Kumari", "Md. Arif"].map((n, i) => (
              <li key={n} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={n} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold">{n}</p>
                  <p className="truncate text-sm text-text-2">{t("rowMeta")}</p>
                </div>
                {i === 0 ? (
                  <StatusPill status="paid" label={t("pill_paid")} />
                ) : i === 1 ? (
                  <StatusPill status="overdue" label={t("pill_overdue")} />
                ) : (
                  <StatusPill status="expiring" label={t("pill_due")} />
                )}
              </li>
            ))}
          </ul>
        </div>
      </Sub>

      <Sub title={t("s_rings")}>
        <Card className="flex flex-wrap justify-around gap-4 p-5">
          <ShiftRing free={26} total={59} label="Morning" sublabel="6 am – 12 pm" ariaLabel="Morning 26" />
          <ShiftRing free={4} total={59} label="Evening" sublabel="12 pm – 6 pm" ariaLabel="Evening 4" />
          <ShiftRing free={59} total={59} label="Night" sublabel="6 pm – 11 pm" ariaLabel="Night 59" />
        </Card>
      </Sub>

      <Sub title={t("s_feedback")}>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-4" aria-busy>
            <div className="flex items-center gap-3">
              <Skeleton className="size-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-24 rounded-[14px]" />
          </Card>
          <Card>
            <EmptyState icon={Inbox} title={t("emptyTitle")} body={t("emptyBody")} />
          </Card>
          <div className="space-y-2 lg:col-span-2">
            <ToastPreview message={t("toastText")} />
            <ToastPreview message={t("errorText")} tone="error" />
            <ToastPreview message={ts("moved", { name: "Rahul", label: "B3" })} actionLabel={ts("undo")} />
          </div>
          <p role="alert" className="rounded-[12px] bg-danger-soft px-4 py-3 text-base font-medium text-danger lg:col-span-2">
            <MessageCircle className="mr-2 inline size-5 align-[-4px]" aria-hidden />
            {t("errorText")}
          </p>
        </div>
      </Sub>
    </Section>
  );
}

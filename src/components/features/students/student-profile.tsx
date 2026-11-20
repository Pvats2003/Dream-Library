"use client";

import { ArrowLeft, IdCard, Loader2, MessageCircle, Pause, Pencil, Phone, Play, RefreshCw, UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { markLeft, pausePlan, resumePlan, saveNotes, updateStudent, type Result } from "@/actions/students";
import { useAdmit } from "@/components/features/admit/admit-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceGroup } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { StatusPill } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { addDays, dateInTz, daysBetween, formatDay, formatMinutesShort, type AppLocale } from "@/lib/dates";
import type { StudentProfile as Profile } from "@/lib/data/student";
import { formatINR } from "@/lib/money";
import { formatMobile, phoneDigits } from "@/lib/phone";

type Tab = "overview" | "payments" | "attendance" | "notes" | "history";

export function StudentProfileView({
  s,
  today,
  timezone,
  canMarkLeft,
}: {
  s: Profile;
  today: string;
  timezone: string;
  canMarkLeft: boolean;
}) {
  const t = useTranslations("profile");
  const ts = useTranslations("students");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const openAdmit = useAdmit();
  const [tab, setTab] = useState<Tab>("overview");
  const [sheet, setSheet] = useState<"pause" | "left" | "edit" | null>(null);
  const [pending, start] = useTransition();

  const current =
    s.plans.find((p) => p.status === "active" || p.status === "paused") ?? s.plans.find((p) => p.status === "upcoming") ?? null;
  const last = s.plans.find((p) => p.status === "expired") ?? null;
  const owed = s.invoices.filter((i) => i.status === "due" || i.status === "partial").reduce((n, i) => n + i.amountDuePaise - i.amountPaidPaise, 0);
  const held = s.deposits.find((d) => d.status === "held");

  function run(action: () => Promise<Result>, ok: string) {
    start(async () => {
      const res = await action();
      if (!res.ok) {
        toast(
          t(res.error === "noPermission" ? "errNoPermission" : res.error === "phoneExists" ? "errPhoneExists" : res.error === "invalid" ? "invalidPhone" : "errFailed"),
          { tone: "error" },
        );
        return;
      }
      setSheet(null);
      toast(ok);
      router.refresh();
    });
  }

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: t("tabOverview") },
    { value: "payments", label: t("tabPayments") },
    { value: "attendance", label: t("tabAttendance") },
    { value: "notes", label: t("tabNotes") },
    ...(s.activity ? [{ value: "history" as const, label: t("tabHistory") }] : []),
  ];

  return (
    <div className="pb-6">
      <div className="pt-4 lg:pt-8">
        <Link href="/students" className="-ml-3 inline-flex h-12 items-center gap-1 rounded-[12px] px-3 text-base font-medium text-text-2 hover:bg-surface-2">
          <ArrowLeft className="size-5" aria-hidden />
          {t("back")}
        </Link>
      </div>

      {/* Header */}
      <header className="mt-2 flex items-center gap-4">
        <Avatar name={s.name} src={s.photoUrl} className="size-[72px] text-xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{s.name}</h1>
          <p className="text-base text-text-2 tabular">{formatMobile(s.phone, true)}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {s.status === "left" ? (
              <StatusPill status="left" label={ts("statusLeft")} />
            ) : s.status === "paused" ? (
              <StatusPill status="paused" label={ts("statusPaused")} />
            ) : (
              <StatusPill status="paid" label={ts("statusActive")} />
            )}
            {owed > 0 ? <StatusPill status="overdue" label={t("invoiceDue", { due: formatINR(owed) })} /> : null}
            {s.examTarget ? <StatusPill status="neutral" label={s.examTarget} /> : null}
          </div>
        </div>
      </header>

      {/* Quick actions — always visible, always labelled */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        <a href={`tel:${s.phone}`} className={buttonVariants({ variant: "secondary", className: "h-16 flex-col gap-0.5 text-sm" })}>
          <Phone aria-hidden />
          {t("call")}
        </a>
        <a
          href={`https://wa.me/${phoneDigits(s.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "secondary", className: "h-16 flex-col gap-0.5 text-sm" })}
        >
          <MessageCircle aria-hidden />
          {t("whatsapp")}
        </a>
        <Button variant="soft" className="h-16 flex-col gap-0.5 text-sm" onClick={() => openAdmit({ phone: s.phone })}>
          <RefreshCw aria-hidden />
          {s.status === "left" ? t("readmit") : t("renew")}
        </Button>
      </div>

      {s.status === "left" ? <p className="mt-4 rounded-[12px] bg-surface-2 px-4 py-3 text-base text-text-2">{t("leftBanner")}</p> : null}

      {/* Current plan */}
      <Card className="mt-4 p-4">
        <h2 className="text-sm font-semibold text-text-2">{t("currentPlan")}</h2>
        {current ? (
          <>
            <p className="mt-1 text-lg font-semibold">
              {current.planName}
              <span className="font-normal text-text-2"> · {current.seatLabel ? t("seat", { label: current.seatLabel }) : t("noSeat")}</span>
            </p>
            <p className="text-sm text-text-2 tabular">
              {current.shiftName} · {formatMinutesShort(current.startMin, locale)} – {formatMinutesShort(current.endMin, locale)}
            </p>
            <p className="mt-2 text-base">
              {formatDay(current.startDate, locale)} – {formatDay(current.endDate, locale, { year: true })}
            </p>
            <p
              className={cn(
                "mt-0.5 text-base font-semibold",
                current.status === "paused" ? "text-info" : daysBetween(today, current.endDate) <= 7 ? "text-warning" : "text-success",
              )}
            >
              {current.status === "paused" && s.pauseUntil
                ? t("pausedUntil", { date: formatDay(s.pauseUntil, locale) })
                : current.status === "upcoming"
                  ? t("startsOn", { date: formatDay(current.startDate, locale) })
                  : t("daysLeft", { days: Math.max(0, daysBetween(today, current.endDate)) })}
            </p>
            {current.status === "active" ? (
              <Button variant="secondary" className="mt-3" onClick={() => setSheet("pause")}>
                <Pause aria-hidden />
                {t("pause")}
              </Button>
            ) : current.status === "paused" ? (
              <Button variant="secondary" className="mt-3" disabled={pending} onClick={() => run(() => resumePlan(s.id, current.id), t("resumed"))}>
                <Play aria-hidden />
                {t("resume")}
              </Button>
            ) : null}
          </>
        ) : (
          <p className="mt-1 text-base text-text-2">
            {t("noPlan")}
            {last ? ` · ${t("endedDaysAgo", { days: Math.max(1, daysBetween(last.endDate, today)) })}` : ""}
          </p>
        )}
      </Card>

      <Segmented className="mt-5" label={s.name} value={tab} onChange={setTab} options={tabs} />

      <div className="mt-4">
        {tab === "overview" ? (
          <Overview s={s} locale={locale} held={held} />
        ) : tab === "payments" ? (
          <Payments s={s} locale={locale} />
        ) : tab === "attendance" ? (
          <Attendance s={s} today={today} timezone={timezone} locale={locale} />
        ) : tab === "notes" ? (
          <Notes s={s} />
        ) : (
          <History s={s} locale={locale} timezone={timezone} />
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={() => setSheet("edit")}>
          <Pencil aria-hidden />
          {t("edit")}
        </Button>
        {canMarkLeft && s.status !== "left" ? (
          <Button variant="ghost" className="text-danger" onClick={() => setSheet("left")}>
            <UserX aria-hidden />
            {t("markLeft")}
          </Button>
        ) : null}
      </div>

      {current?.status === "active" ? (
        <PauseSheet
          open={sheet === "pause"}
          onClose={() => setSheet(null)}
          pending={pending}
          onConfirm={(days, reason) =>
            run(() => pausePlan(s.id, current.id, days, reason), t("paused", { date: formatDay(addDays(current.endDate, days), locale) }))
          }
        />
      ) : null}
      <LeftSheet
        open={sheet === "left"}
        onClose={() => setSheet(null)}
        pending={pending}
        depositPaise={held?.amountPaise ?? 0}
        onConfirm={(dep, note) => run(() => markLeft(s.id, dep, note), t("markedLeft", { name: s.name }))}
      />
      <EditSheet open={sheet === "edit"} onClose={() => setSheet(null)} pending={pending} s={s} onSave={(input) => run(() => updateStudent(input), t("saved"))} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-base text-text-2">{label}</dt>
      <dd className="text-right text-base font-medium">{children}</dd>
    </div>
  );
}

function Overview({ s, locale, held }: { s: Profile; locale: AppLocale; held: Profile["deposits"][number] | undefined }) {
  const t = useTranslations("profile");
  const ta = useTranslations("admit");
  const dep = s.deposits[0];
  return (
    <dl className="divide-y divide-border rounded-[14px] border border-border bg-surface">
      <Row label={t("phone")}>
        <span className="tabular">{formatMobile(s.phone)}</span>
      </Row>
      {s.altPhone ? (
        <Row label={t("altPhone")}>
          <span className="tabular">{formatMobile(s.altPhone)}</span>
        </Row>
      ) : null}
      <Row label={t("guardianPhone")}>{s.guardianPhone ? <a className="tabular text-brand" href={`tel:${s.guardianPhone}`}>{formatMobile(s.guardianPhone)}</a> : t("notSet")}</Row>
      <Row label={t("gender")}>{s.gender ? ta(s.gender) : t("notSet")}</Row>
      <Row label={t("exam")}>{s.examTarget ?? t("notSet")}</Row>
      <Row label={t("joined")}>{formatDay(s.joinedOn, locale, { year: true })}</Row>
      <Row label={t("source")}>{s.source ? t(`source_${s.source}` as "source_other") : t("notSet")}</Row>
      <Row label={t("deposit")}>
        {held
          ? t("depositHeld", { amount: formatINR(held.amountPaise) })
          : dep
            ? dep.status === "refunded"
              ? t("depositRefunded", { amount: formatINR(dep.amountPaise) })
              : t("depositAdjusted", { amount: formatINR(dep.amountPaise) })
            : t("noDeposit")}
      </Row>
      {s.address ? <Row label={t("address")}>{s.address}</Row> : null}
      {s.idProofUrl ? (
        <Row label={t("idProof")}>
          <a href={s.idProofUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand">
            <IdCard className="size-4" aria-hidden />
            {t("viewId")}
          </a>
        </Row>
      ) : null}
    </dl>
  );
}

function Payments({ s, locale }: { s: Profile; locale: AppLocale }) {
  const t = useTranslations("profile");
  const ta = useTranslations("admit");
  if (s.invoices.length === 0) return <p className="py-8 text-center text-base text-text-2">{t("noPayments")}</p>;
  return (
    <ul className="space-y-3">
      {s.invoices.map((i) => (
        <li key={i.id} className="rounded-[14px] border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold">
                {i.periodStart && i.periodEnd
                  ? t("invoiceFor", { start: formatDay(i.periodStart, locale), end: formatDay(i.periodEnd, locale, { year: true }) })
                  : formatDay(i.dueDate, locale, { year: true })}
              </p>
              <p
                className={cn(
                  "text-sm font-medium",
                  i.status === "paid" ? "text-success" : i.status === "waived" ? "text-text-3" : "text-danger",
                )}
              >
                {i.status === "paid"
                  ? t("invoicePaid")
                  : i.status === "waived"
                    ? t("invoiceWaived")
                    : i.status === "partial"
                      ? t("invoicePartial", { paid: formatINR(i.amountPaidPaise), due: formatINR(i.amountDuePaise - i.amountPaidPaise) })
                      : t("invoiceDue", { due: formatINR(i.amountDuePaise) })}
              </p>
            </div>
            <span className="text-lg font-bold tabular">{formatINR(i.amountDuePaise)}</span>
          </div>
          {i.payments.length ? (
            <ul className="mt-2 space-y-1 border-t border-border pt-2">
              {i.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 text-sm text-text-2">
                  <span>
                    {formatDay(dateInTz(new Date(p.receivedAt)), locale)} · {ta(p.method as "cash")}
                    {p.receiptNumber ? ` · ${t("receipt", { number: p.receiptNumber })}` : ""}
                  </span>
                  <span className={cn("font-semibold tabular", p.amountPaise < 0 ? "text-danger" : "text-text")}>{formatINR(p.amountPaise)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function Attendance({ s, today, timezone, locale }: { s: Profile; today: string; timezone: string; locale: AppLocale }) {
  const t = useTranslations("profile");
  if (s.attendance.length === 0) return <p className="py-8 text-center text-base text-text-2">{t("noAttendance")}</p>;
  const month = today.slice(0, 7);
  const days = new Set(s.attendance.map((a) => dateInTz(new Date(a.checkInAt), timezone)).filter((d) => d.startsWith(month)));
  const time = (iso: string) =>
    new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
  return (
    <div>
      <p className="mb-3 text-base font-semibold">{t("thisMonth", { count: days.size })}</p>
      <ul className="divide-y divide-border rounded-[14px] border border-border bg-surface">
        {s.attendance.slice(0, 30).map((a) => {
          const mins = a.checkOutAt ? Math.round((Date.parse(a.checkOutAt) - Date.parse(a.checkInAt)) / 60000) : null;
          return (
            <li key={a.checkInAt} className="flex items-center justify-between gap-3 px-4 py-3 text-base">
              <span>
                {formatDay(dateInTz(new Date(a.checkInAt), timezone), locale)}
                <span className="text-text-2 tabular"> · {time(a.checkInAt)}{a.checkOutAt ? ` – ${time(a.checkOutAt)}` : ""}</span>
              </span>
              <span className="text-sm text-text-2 tabular">
                {mins === null ? <span className="font-semibold text-success">{t("stillInside")}</span> : t("hours", { h: Math.floor(mins / 60), m: mins % 60 })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Notes({ s }: { s: Profile }) {
  const t = useTranslations("profile");
  const router = useRouter();
  const [value, setValue] = useState(s.notes ?? "");
  const [pending, start] = useTransition();
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={6}
        placeholder={t("notesPlaceholder")}
        aria-label={t("tabNotes")}
        className="w-full rounded-[12px] border border-border-strong bg-surface p-4 text-base focus:border-brand focus:ring-4 focus:ring-brand/15 focus:outline-none"
      />
      <Button
        className="mt-3"
        disabled={pending || value === (s.notes ?? "")}
        onClick={() =>
          start(async () => {
            const res = await saveNotes(s.id, value);
            if (!res.ok) return void toast(t("errFailed"), { tone: "error" });
            toast(t("notesSaved"));
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("saveNotes")}
      </Button>
    </div>
  );
}

function History({ s, locale, timezone }: { s: Profile; locale: AppLocale; timezone: string }) {
  const t = useTranslations("profile");
  if (!s.activity?.length) return <p className="py-8 text-center text-base text-text-2">{t("noHistory")}</p>;
  const when = (iso: string) =>
    new Intl.DateTimeFormat(locale === "hi" ? "hi-IN" : "en-IN", {
      timeZone: timezone,
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  return (
    <ol className="space-y-2">
      {s.activity.map((a) => {
        const key = `hist_${a.action}_${a.entity}`;
        const label = t.has(key as "hist_other") ? t(key as "hist_other") : t("hist_other");
        const amount = a.entity === "payments" ? (a.after as { amount_paise?: number } | null)?.amount_paise : undefined;
        return (
          <li key={a.id} className="flex items-baseline justify-between gap-3 rounded-[12px] bg-surface-2 px-4 py-2.5 text-base">
            <span>
              {label}
              {amount !== undefined ? <span className="font-semibold tabular"> · {formatINR(amount)}</span> : null}
            </span>
            <span className="shrink-0 text-sm text-text-3">{when(a.createdAt)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PauseSheet({ open, onClose, pending, onConfirm }: { open: boolean; onClose: () => void; pending: boolean; onConfirm: (days: number, reason: string) => void }) {
  const t = useTranslations("profile");
  const ta = useTranslations("admit");
  const [days, setDays] = useState<"7" | "15" | "30">("7");
  const [reason, setReason] = useState("");
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("pauseTitle")}
      description={t("pauseHint")}
      closeLabel={ta("close")}
      footer={
        <Button size="lg" block disabled={pending} onClick={() => onConfirm(Number(days), reason)}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Pause aria-hidden />}
          {t("pauseConfirm", { days })}
        </Button>
      }
    >
      <ChoiceGroup
        label={t("pauseTitle")}
        columns={3}
        value={days}
        onChange={setDays}
        options={(["7", "15", "30"] as const).map((d) => ({ value: d, label: t("pauseDays", { days: d }) }))}
      />
      <label htmlFor="pause-reason" className="mt-4 mb-2 block text-sm font-semibold text-text-2">
        {t("pauseReason")}
      </label>
      <Input id="pause-reason" className="h-12 text-base" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Sheet>
  );
}

function LeftSheet({
  open,
  onClose,
  pending,
  depositPaise,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  depositPaise: number;
  onConfirm: (deposit: "refunded" | "adjusted" | "keep", note: string) => void;
}) {
  const t = useTranslations("profile");
  const ta = useTranslations("admit");
  const [dep, setDep] = useState<"refunded" | "adjusted" | "keep">("refunded");
  const [note, setNote] = useState("");
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("leftTitle")}
      description={t("leftHint")}
      closeLabel={ta("close")}
      footer={
        <Button variant="danger" size="lg" block disabled={pending} onClick={() => onConfirm(depositPaise > 0 ? dep : "keep", note)}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <UserX aria-hidden />}
          {t("leftConfirm")}
        </Button>
      }
    >
      {depositPaise > 0 ? (
        <>
          <p className="mb-2 text-sm font-semibold text-text-2">{t("leftDeposit", { amount: formatINR(depositPaise) })}</p>
          <ChoiceGroup
            label={t("leftDeposit", { amount: formatINR(depositPaise) })}
            columns={1}
            value={dep}
            onChange={setDep}
            options={[
              { value: "refunded", label: t("refund") },
              { value: "adjusted", label: t("adjust") },
              { value: "keep", label: t("keep") },
            ]}
          />
        </>
      ) : null}
      <label htmlFor="left-note" className="mt-4 mb-2 block text-sm font-semibold text-text-2">
        {t("leftNote")}
      </label>
      <Input id="left-note" className="h-12 text-base" value={note} onChange={(e) => setNote(e.target.value)} />
    </Sheet>
  );
}

function EditSheet({
  open,
  onClose,
  pending,
  s,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  s: Profile;
  onSave: (input: Parameters<typeof updateStudent>[0]) => void;
}) {
  const t = useTranslations("profile");
  const ta = useTranslations("admit");
  const [f, setF] = useState({
    name: s.name,
    phone: s.phone.replace(/^\+91/, ""),
    altPhone: s.altPhone?.replace(/^\+91/, "") ?? "",
    guardianPhone: s.guardianPhone?.replace(/^\+91/, "") ?? "",
    gender: s.gender,
    examTarget: s.examTarget ?? "",
    address: s.address ?? "",
  });
  const field = (key: "name" | "phone" | "altPhone" | "guardianPhone" | "examTarget" | "address", label: string, numeric = false) => (
    <div>
      <label htmlFor={`edit-${key}`} className="mb-1.5 block text-sm font-semibold text-text-2">
        {label}
      </label>
      <Input
        id={`edit-${key}`}
        className="h-12 text-base"
        inputMode={numeric ? "numeric" : undefined}
        value={f[key]}
        onChange={(e) => setF({ ...f, [key]: e.target.value })}
      />
    </div>
  );
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("editTitle")}
      closeLabel={ta("close")}
      footer={
        <Button size="lg" block disabled={pending || !f.name.trim()} onClick={() => onSave({ id: s.id, ...f, notes: s.notes ?? "" })}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("save")}
        </Button>
      }
    >
      <div className="space-y-4">
        {field("name", ta("nameLabel"))}
        {field("phone", t("phone"), true)}
        <div>
          <p className="mb-1.5 text-sm font-semibold text-text-2">{ta("genderLabel")}</p>
          <ChoiceGroup
            label={ta("genderLabel")}
            columns={3}
            value={f.gender}
            onChange={(g) => setF({ ...f, gender: g })}
            options={[
              { value: "male", label: ta("male") },
              { value: "female", label: ta("female") },
              { value: "other", label: ta("other") },
            ]}
          />
        </div>
        {field("examTarget", t("exam"))}
        {field("guardianPhone", t("guardianPhone"), true)}
        {field("altPhone", t("altPhone"), true)}
        {field("address", t("address"))}
      </div>
    </Sheet>
  );
}

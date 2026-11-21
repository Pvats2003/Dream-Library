"use client";

import { AlertCircle, CircleCheck, Loader2, QrCode, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import type { AdmitData } from "@/actions/admit";
import { importMany, importStudent, rejectRequest, type ImportInput } from "@/actions/requests";
import { EmptyState } from "@/components/patterns/empty-state";
import { BackLink } from "@/components/patterns/back-link";
import { Avatar } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChoiceGroup, MoneyInput } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { formatDay, type AppLocale } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatMobile, normalizeIndianMobile } from "@/lib/phone";
import { analyzeRequest, defaultPlanFor, periodFor, resolveBatch, type JoinRequest, type Proposal } from "@/lib/requests";
import { isSeatFree } from "@/lib/seats";

type Item = { request: JoinRequest; proposal: Proposal };

export function RequestsInbox({ requests, data, existingPhones }: { requests: JoinRequest[]; data: AdmitData; existingPhones: string[] }) {
  const t = useTranslations("requests");
  const ts = useTranslations("students");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [open, setOpen] = useState<JoinRequest | "new" | null>(null);
  const [busy, start] = useTransition();

  const items: Item[] = useMemo(() => {
    const ctx = {
      plans: data.plans,
      shifts: data.shifts,
      seats: data.seats,
      existingPhones: new Set(existingPhones),
      today: data.today,
    };
    return resolveBatch(requests.map((r) => ({ request: r, proposal: analyzeRequest(r, ctx) })));
  }, [requests, data, existingPhones]);

  const clean = items.filter((i) => i.proposal.problems.length === 0);
  const shiftName = (id: string | null) => data.shifts.find((s) => s.id === id)?.name;

  function toInput(i: Item): ImportInput {
    return {
      requestId: i.request.id,
      name: i.request.name,
      phone: i.request.phone,
      gender: i.request.gender,
      examTarget: i.request.examTarget,
      planId: i.proposal.planId!,
      seatId: i.proposal.seatId,
      startDate: i.proposal.startDate,
      pendingPaise: 0,
    };
  }

  return (
    <div className="pb-6">
      <div className="pt-4 lg:pt-8">
        <BackLink href="/students">{ts("title")}</BackLink>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="mt-1 text-base text-text-2">{t("subtitle", { count: requests.length })}</p>
          </div>
          <Link href="/more/join" className={buttonVariants({ variant: "secondary", size: "sm", className: "h-11" })}>
            <QrCode aria-hidden />
            {t("openQr")}
          </Link>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {clean.length > 0 ? (
          <Button
            size="lg"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const res = await importMany(clean.map(toInput));
                toast(t("approvedMany", { count: res.added }), res.failed.length ? { tone: "error" } : {});
                router.refresh();
              })
            }
          >
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
            {t("approveAllClean", { count: clean.length })}
          </Button>
        ) : null}
        <Button variant="secondary" size="lg" onClick={() => setOpen("new")}>
          <UserPlus aria-hidden />
          {t("addMyself")}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState art="owl" title={t("empty")} body={t("emptyBody")} action={<Link href="/more/join" className={buttonVariants({ variant: "secondary", block: true })}>{t("emptyAction")}</Link>} />
      ) : (
        <ul className="mt-4 space-y-3" aria-label={t("title")}>
          {items.map(({ request: r, proposal: p }) => (
            <li key={r.id} className="rounded-[14px] border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <Avatar name={r.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold">{r.name}</p>
                  <p className="text-sm text-text-2 tabular">{formatMobile(r.phone)}</p>
                  <p className="mt-1 text-sm text-text-2">
                    {[shiftName(r.shiftId), r.seatLabel ? t("seatSaid", { label: r.seatLabel }) : null, r.lastPaidOn ? t("paidOn", { date: formatDay(r.lastPaidOn, locale) }) : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.problems.length === 0 ? (
                  <span className="inline-flex h-7 items-center gap-1 rounded-full bg-success-soft px-2.5 text-xs font-semibold text-success">
                    <CircleCheck className="size-3.5" aria-hidden />
                    {t("allClear")}
                  </span>
                ) : (
                  p.problems.map((x) => (
                    <span key={x} className="inline-flex h-7 items-center gap-1 rounded-full bg-warning-soft px-2.5 text-xs font-semibold text-warning">
                      <AlertCircle className="size-3.5" aria-hidden />
                      {t(`p_${x}`)}
                    </span>
                  ))
                )}
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                {p.problems.length === 0 ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const res = await importStudent(toInput({ request: r, proposal: p }));
                        if (!res.ok) return void toast(t(errKey(res.error)), { tone: "error" });
                        toast(t("approved", { name: r.name }));
                        router.refresh();
                      })
                    }
                  >
                    <CircleCheck aria-hidden />
                    {t("approve")}
                  </Button>
                ) : (
                  <Button variant="soft" onClick={() => setOpen(r)}>
                    {t("review")}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="text-danger"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const res = await rejectRequest(r.id);
                      if (!res.ok) return void toast(t("errFailed"), { tone: "error" });
                      toast(t("rejected"));
                      router.refresh();
                    })
                  }
                >
                  {t("reject")}
                </Button>
              </div>
              {p.problems.length === 0 ? (
                <button type="button" onClick={() => setOpen(r)} className="mt-2 text-sm font-medium text-brand underline-offset-2 hover:underline">
                  {t("review")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <ConfirmSheet
          key={open === "new" ? "new" : open.id}
          request={open === "new" ? null : open}
          proposal={open === "new" ? null : (items.find((i) => i.request.id === open.id)?.proposal ?? null)}
          data={data}
          onClose={() => setOpen(null)}
          onDone={(name) => {
            setOpen(null);
            toast(t("approved", { name }));
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function errKey(e: "phoneExists" | "seatTaken" | "alreadyDone" | "invalid" | "failed") {
  return ({ phoneExists: "errPhoneExists", seatTaken: "errSeatTaken", alreadyDone: "errAlreadyDone", invalid: "errInvalid", failed: "errFailed" } as const)[e];
}

/** The one card used both to confirm a request and to add someone by hand. */
function ConfirmSheet({
  request,
  proposal,
  data,
  onClose,
  onDone,
}: {
  request: JoinRequest | null;
  proposal: Proposal | null;
  data: AdmitData;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const t = useTranslations("requests");
  const ta = useTranslations("admit");
  const locale = useLocale() as AppLocale;
  const [name, setName] = useState(request?.name ?? "");
  const [digits, setDigits] = useState(request?.phone.replace(/^\+91/, "") ?? "");
  const [gender, setGender] = useState(request?.gender ?? null);
  const [planId, setPlanId] = useState<string>(proposal?.planId ?? defaultPlanFor(data.plans[0]?.shiftId ?? null, data.plans)?.id ?? data.plans[0]?.id ?? "");
  const [startDate, setStartDate] = useState(proposal?.startDate ?? request?.lastPaidOn ?? data.today);
  const [seatId, setSeatId] = useState<string>(proposal?.seatId ?? "");
  const [fees, setFees] = useState<"paid" | "some" | "none">("paid");
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const plan = data.plans.find((p) => p.id === planId);
  const shift = data.shifts.find((s) => s.id === plan?.shiftId);
  const period = plan && startDate ? periodFor(plan, startDate) : null;
  const ended = period ? period.end < data.today : false;
  const freeSeats = useMemo(() => {
    if (!shift || !period) return [];
    return data.seats.filter((s) => isSeatFree(s, { startMin: shift.startMin, endMin: shift.endMin, startDate: period.start, endDate: period.end }));
  }, [data.seats, shift, period]);
  const zoneName = (id: string | null) => data.zones.find((z) => z.id === id)?.name ?? "";
  const pendingPaise = fees === "paid" ? 0 : fees === "none" ? (plan?.pricePaise ?? 0) : (pending ?? 0);

  function save() {
    setError(null);
    if (!name.trim() || !normalizeIndianMobile(digits) || !plan) return setError(t("errInvalid"));
    start(async () => {
      const res = await importStudent({
        requestId: request?.id ?? null,
        name,
        phone: digits,
        gender,
        examTarget: request?.examTarget ?? null,
        planId: plan.id,
        seatId: ended ? null : seatId || null,
        startDate,
        pendingPaise: Math.min(pendingPaise, plan.pricePaise),
      });
      if (!res.ok) return setError(t(errKey(res.error)));
      onDone(name.trim());
    });
  }

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={request ? t("sheetTitle", { name: request.name }) : t("addTitle")}
      description={request ? undefined : t("addHint")}
      closeLabel={ta("close")}
      footer={
        <Button size="lg" block disabled={busy} onClick={save}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : <CircleCheck aria-hidden />}
          {t("save")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Row label={t("name")} htmlFor="rq-name">
          <Input id="rq-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} />
        </Row>
        <Row label={t("phone")} htmlFor="rq-phone">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-base font-medium text-text-2">+91</span>
            <Input id="rq-phone" inputMode="numeric" className="h-12 pl-14 text-base tabular" value={digits} onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(-10))} />
          </div>
        </Row>
        <ChoiceGroup
          label={ta("genderLabel")}
          columns={3}
          value={gender}
          onChange={setGender}
          options={[
            { value: "male", label: ta("male") },
            { value: "female", label: ta("female") },
            { value: "other", label: ta("other") },
          ]}
        />
        <Row label={t("plan")} htmlFor="rq-plan">
          <select
            id="rq-plan"
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              setSeatId("");
            }}
            className="h-12 w-full rounded-[12px] border border-border-strong bg-surface px-3 text-base"
          >
            {data.plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatINR(p.pricePaise)}
              </option>
            ))}
          </select>
        </Row>
        <Row label={t("periodStart")} htmlFor="rq-start">
          <Input id="rq-start" type="date" className="h-12 w-56 text-base" max={data.today} value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} />
        </Row>
        {period ? (
          <p className={ended ? "rounded-[12px] bg-warning-soft px-4 py-3 text-base font-medium text-warning" : "text-base text-text-2"}>
            {ended
              ? t("endedWarning", { date: formatDay(period.end, locale) })
              : t("period", { start: formatDay(period.start, locale), end: formatDay(period.end, locale, { year: true }) })}
          </p>
        ) : null}
        {!ended ? (
          <Row label={t("seat")} htmlFor="rq-seat">
            <select
              id="rq-seat"
              value={seatId}
              onChange={(e) => setSeatId(e.target.value)}
              className="h-12 w-full rounded-[12px] border border-border-strong bg-surface px-3 text-base"
            >
              <option value="">{t("noSeatOption")}</option>
              {freeSeats.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} · {zoneName(s.zoneId)}
                </option>
              ))}
            </select>
          </Row>
        ) : null}
        <div>
          <p className="mb-2 text-sm font-semibold text-text-2">{t("feesStatus")}</p>
          <ChoiceGroup
            label={t("feesStatus")}
            columns={1}
            value={fees}
            onChange={setFees}
            options={[
              { value: "paid", label: t("feesAllPaid") },
              { value: "some", label: t("feesSome") },
              { value: "none", label: t("feesNone"), hint: plan ? formatINR(plan.pricePaise) : undefined },
            ]}
          />
          {fees === "some" ? (
            <div className="mt-3">
              <label htmlFor="rq-pending" className="mb-1.5 block text-sm font-semibold text-text-2">
                {t("pendingAmount")}
              </label>
              <MoneyInput id="rq-pending" valuePaise={pending} onChange={setPending} />
            </div>
          ) : null}
        </div>
        {error ? (
          <p role="alert" className="rounded-[12px] bg-danger-soft px-4 py-3 text-base font-medium text-danger">
            {error}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function Row({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-text-2">
        {label}
      </label>
      {children}
    </div>
  );
}

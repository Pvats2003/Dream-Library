"use client";

import { ArrowLeft, Camera, CircleCheck, IdCard, Loader2, MessageCircle, RefreshCw, Star, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  admitStudent,
  getAdmitData,
  lookupStudent,
  type AdmitData,
  type AdmitError,
  type AdmitResult,
  type ExistingStudent,
} from "@/actions/admit";
import { Button, buttonVariants } from "@/components/ui/button";
import { ChoiceGroup, MoneyInput } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { squareImage, uploadStudentFile } from "@/lib/client/photo";
import { cn } from "@/lib/cn";
import { addDays, formatDay, formatMinutesShort, planPeriod, type AppLocale } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatMobile, normalizeIndianMobile, phoneDigits } from "@/lib/phone";
import { isSeatFree, suggestSeats, type SeatInfo } from "@/lib/seats";
import { fillTemplate } from "@/lib/templates";
import { Keypad, useBigKeypad } from "@/components/ui/keypad";
import { paymentFeedback } from "@/lib/client/feedback";
import { SeatTile } from "@/components/features/seats/seat-tile";
import { initials } from "@/components/ui/avatar";

export type AdmitPrefill = { seatId?: string; shiftId?: string; phone?: string };

const EXAMS = ["BPSC", "SSC", "Railway", "Bank", "NEET", "JEE", "UPSC", "Police", "College"];
type Step = "phone" | "details" | "plan" | "seat" | "pay" | "done";
type Method = "cash" | "upi" | "card" | "bank";

export function AdmitFlow({ open, onOpenChange, prefill }: { open: boolean; onOpenChange: (o: boolean) => void; prefill?: AdmitPrefill }) {
  const t = useTranslations("admit");
  const locale = useLocale() as AppLocale;
  const router = useRouter();

  const [data, setData] = useState<AdmitData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [step, setStep] = useState<Step>("phone");
  const bigKeys = useBigKeypad();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [opId, setOpId] = useState(() => crypto.randomUUID());
  const [digits, setDigits] = useState("");
  const [phone, setPhone] = useState("");
  const [existing, setExisting] = useState<ExistingStudent | null>(null);
  const [mode, setMode] = useState<"new" | "renew">("new");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(null);
  const [exam, setExam] = useState<string | null>(null);
  const [examOther, setExamOther] = useState("");
  const [photo, setPhoto] = useState<{ path: string | null; preview: string; uploading: boolean } | null>(null);
  const [idProof, setIdProof] = useState<{ path: string | null; uploading: boolean } | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [seatId, setSeatId] = useState<string | null | undefined>(undefined); // undefined = not chosen, null = no seat
  const [showMap, setShowMap] = useState(false);
  const [payChoice, setPayChoice] = useState<"full" | "part" | "later">("full");
  const [partPaise, setPartPaise] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("upi");
  const [deposit, setDeposit] = useState<"yes" | "no">("yes");
  const [discountOn, setDiscountOn] = useState(false);
  const [discountPaise, setDiscountPaise] = useState<number | null>(null);
  const [discountReason, setDiscountReason] = useState("");
  const [result, setResult] = useState<Extract<AdmitResult, { ok: true }> | null>(null);

  const reset = (keepData = true) => {
    if (!keepData) setData(null);
    setStep("phone");
    setError(null);
    setOpId(crypto.randomUUID());
    setDigits("");
    setPhone("");
    setExisting(null);
    setMode("new");
    setName("");
    setGender(null);
    setExam(null);
    setExamOther("");
    setPhoto(null);
    setIdProof(null);
    setPlanId(null);
    setSeatId(undefined);
    setShowMap(false);
    setPayChoice("full");
    setPartPaise(null);
    setMethod("upi");
    setDeposit("yes");
    setDiscountOn(false);
    setDiscountPaise(null);
    setDiscountReason("");
    setResult(null);
  };

  // Load plans/seats each time the sheet opens, so seats are current.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getAdmitData()
      .then((d) => {
        if (cancelled) return;
        setLoadError(false);
        setData(d);
        setStartDate((s) => s || d.today);
        if (prefill?.shiftId) {
          const p = d.plans.find((x) => x.shiftId === prefill.shiftId);
          if (p) setPlanId((cur) => cur ?? p.id);
        }
        if (prefill?.seatId) setSeatId((cur) => (cur === undefined ? prefill.seatId : cur));
        if (prefill?.phone) {
          const local = prefill.phone.replace(/^\+91/, "");
          setDigits(local);
          lookupStudent(prefill.phone).then((res) => {
            if (cancelled || !res.ok) return;
            setPhone(res.phone);
            setExisting(res.existing);
          });
        }
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, [open, prefill?.seatId, prefill?.shiftId, prefill?.phone]);

  const plan = data?.plans.find((p) => p.id === planId) ?? null;
  const shift = plan ? data?.shifts.find((s) => s.id === plan.shiftId) : undefined;
  // For renewals the server continues from the old end date; mirror that so
  // the seat check and dates on screen match what will be saved.
  const effectiveStart = useMemo(() => {
    if (mode === "renew" && existing?.endDate && data && existing.endDate >= addDays(data.today, -1)) {
      return addDays(existing.endDate, 1);
    }
    return startDate;
  }, [mode, existing, data, startDate]);
  const effectivePeriod = useMemo(() => {
    if (!plan || !effectiveStart) return null;
    return planPeriod(effectiveStart, plan.months ? { months: plan.months } : { days: plan.days ?? 30 });
  }, [plan, effectiveStart]);

  const want = useMemo(
    () =>
      shift && effectivePeriod
        ? { startMin: shift.startMin, endMin: shift.endMin, startDate: effectivePeriod.start, endDate: effectivePeriod.end }
        : null,
    [shift, effectivePeriod],
  );

  // Bookings that belong to this same student don't block their own renewal.
  const seatsForCheck = useMemo(
    () =>
      (data?.seats ?? []).map((s) => ({
        ...s,
        bookings: s.bookings.filter((b) => !existing || b.studentId !== existing.id),
      })),
    [data, existing],
  );
  const suggestions = useMemo(() => {
    if (!data || !want) return [];
    return suggestSeats({
      seats: seatsForCheck,
      zones: data.zones,
      want,
      gender,
      previousSeatId: existing?.seatId,
    });
  }, [data, want, seatsForCheck, gender, existing]);

  const feePaise = plan ? plan.pricePaise : 0;
  const discount = discountOn ? Math.min(discountPaise ?? 0, feePaise) : 0;
  const due = feePaise - discount;
  const paying = payChoice === "full" ? due : payChoice === "part" ? (partPaise ?? 0) : 0;

  const steps: Step[] = mode === "renew" ? ["phone", "plan", "seat", "pay"] : ["phone", "details", "plan", "seat", "pay"];
  const index = steps.indexOf(step);

  function go(to: Step) {
    setError(null);
    setStep(to);
  }

  function next() {
    setError(null);
    if (step === "phone") {
      const n = normalizeIndianMobile(digits);
      if (!n) return setError(t("invalidPhone"));
      start(async () => {
        const res = await lookupStudent(n);
        if (!res.ok) return setError(t("invalidPhone"));
        setPhone(res.phone);
        setExisting(res.existing);
        if (res.existing && res.existing.status === "left") {
          setName(res.existing.name);
          setGender(res.existing.gender);
          setExam(res.existing.examTarget && EXAMS.includes(res.existing.examTarget) ? res.existing.examTarget : res.existing.examTarget ? "other" : null);
          setExamOther(res.existing.examTarget && !EXAMS.includes(res.existing.examTarget) ? res.existing.examTarget : "");
          go("details");
        } else if (!res.existing) {
          go("details");
        }
        // Existing active student: the screen shows "renew instead" — no auto-advance.
      });
      return;
    }
    if (step === "details") {
      if (!name.trim()) return setError(t("nameRequired"));
      return go("plan");
    }
    if (step === "plan") {
      if (!plan) return;
      return go("seat");
    }
    if (step === "seat") {
      if (seatId === undefined) setSeatId(suggestions[0]?.id ?? null);
      return go("pay");
    }
    if (step === "pay") submit();
  }

  function startRenew() {
    if (!existing) return;
    setMode("renew");
    setName(existing.name);
    setGender(existing.gender);
    if (existing.planId && data?.plans.some((p) => p.id === existing.planId)) setPlanId(existing.planId);
    setDeposit("no");
    go("plan");
  }

  function submit() {
    if (!data || !plan || !effectivePeriod) return;
    if (payChoice === "part") {
      if (!partPaise) return setError(t("amountRequired"));
      if (partPaise > due) return setError(t("amountTooHigh"));
    }
    if (discount > 0 && !discountReason.trim()) return setError(t("discountReasonRequired"));
    start(async () => {
      const res = await admitStudent({
        clientOpId: opId,
        mode,
        studentId: existing?.id,
        phone,
        name: name.trim(),
        gender,
        examTarget: exam === "other" ? examOther.trim() || null : exam,
        photoPath: photo?.path ?? null,
        idProofPath: idProof?.path ?? null,
        planId: plan.id,
        startDate: effectiveStart,
        seatId: seatId ?? null,
        discountPaise: discount,
        discountReason: discount > 0 ? discountReason.trim() : null,
        payment: paying > 0 ? { amountPaise: paying, method, reference: null } : null,
        depositPaise: mode === "new" && deposit === "yes" ? data.depositPaise : 0,
        depositMethod: method,
      });
      if (!res.ok) {
        const key: Record<AdmitError, string> = {
          seatTaken: "errSeatTaken",
          phoneExists: "errPhoneExists",
          noDiscount: "errNoDiscount",
          overpayment: "errOverpayment",
          invalid: "errFailed",
          failed: "errFailed",
        };
        setError(t(key[res.error]));
        navigator.vibrate?.(80);
        if (res.error === "seatTaken") {
          // Refresh seats and send them back to choose another.
          setSeatId(undefined);
          setOpId(crypto.randomUUID());
          getAdmitData().then(setData);
          go("seat");
          setError(t("errSeatTaken"));
        }
        return;
      }
      setResult(res);
      if (paying > 0) paymentFeedback();
      setStep("done");
      navigator.vibrate?.([20, 40, 20]);
      router.refresh();
    });
  }

  const title = mode === "renew" ? t("renewTitle") : t("title");
  const primaryLabel =
    step === "pay" ? (pending ? t("saving") : mode === "renew" ? t("confirmRenew") : t("confirm")) : t("next");
  const primaryDisabled =
    pending ||
    !data ||
    (step === "phone" && (digits.length !== 10 || (existing !== null && existing.status !== "left" && phone === normalizeIndianMobile(digits)))) ||
    (step === "plan" && !plan) ||
    (step === "details" && (photo?.uploading || idProof?.uploading));

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o && step === "done") reset();
      }}
      title={step === "done" ? "" : title}
      closeLabel={t("close")}
      footer={
        step === "done" || !data ? undefined : (
          <div className="flex gap-3">
            {index > 0 ? (
              <Button variant="secondary" size="lg" onClick={() => go(steps[index - 1])} disabled={pending} aria-label={t("back")}>
                <ArrowLeft aria-hidden />
                <span className="sr-only sm:not-sr-only">{t("back")}</span>
              </Button>
            ) : null}
            <Button size="lg" block onClick={next} disabled={primaryDisabled}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {primaryLabel}
            </Button>
          </div>
        )
      }
    >
      <div
        onKeyDown={(e) => {
          // Desktop: Enter moves on from any step (Tab moves between fields).
          const el = e.target as HTMLElement;
          if (e.key !== "Enter" || e.shiftKey || step === "done" || el.closest("textarea, button, a, [role=radio]")) return;
          e.preventDefault();
          if (!primaryDisabled) next();
        }}
      >
      {step !== "done" ? (
        <div className="mb-5 flex items-center gap-3" aria-hidden>
          <div className="flex flex-1 gap-1.5">
            {steps.map((s, i) => (
              <span key={s} className={cn("h-1.5 flex-1 rounded-full transition-colors duration-300", i <= index ? "bg-brand" : "bg-surface-3")} />
            ))}
          </div>
          <span className="text-sm text-text-3 tabular">{t("stepOf", { step: index + 1, total: steps.length })}</span>
        </div>
      ) : null}

      {loadError ? (
        <div className="py-10 text-center">
          <p className="text-base text-text-2">{t("errLoad")}</p>
          <Button className="mt-4" variant="secondary" onClick={() => getAdmitData().then(setData).catch(() => setLoadError(true))}>
            <RefreshCw aria-hidden /> {t("next")}
          </Button>
        </div>
      ) : !data ? (
        <div className="space-y-3" aria-busy>
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-14" />
        </div>
      ) : data.plans.length === 0 ? (
        <p className="py-10 text-center text-base text-text-2">{t("noPlans")}</p>
      ) : (
        <>
          {step === "phone" ? (
            <section>
              <h3 className="text-lg font-semibold">{t("phoneTitle")}</h3>
              <p className="text-sm text-text-2">{t("phoneHint")}</p>
              <label htmlFor="admit-phone" className="sr-only">
                {t("phoneLabel")}
              </label>
              <div className="relative mt-4">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-medium text-text-2 tabular">+91</span>
                <Input
                  id="admit-phone"
                  type="tel"
                  inputMode={bigKeys ? "none" : "numeric"}
                  autoComplete="off"
                  autoFocus
                  placeholder="98765 43210"
                  className="pl-14 tabular tracking-wide"
                  value={digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits}
                  onChange={(e) => {
                    let d = e.target.value.replace(/\D/g, "");
                    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
                    if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
                    setDigits(d.slice(0, 10));
                    setExisting(null);
                    setError(null);
                  }}
                />
              </div>
              {bigKeys ? (
                <Keypad
                  deleteLabel={t("deleteDigit")}
                  onKey={(k) => {
                    setDigits((d) => (k === "del" ? d.slice(0, -1) : (d + k).slice(0, 10)));
                    setExisting(null);
                    setError(null);
                  }}
                />
              ) : null}
              {existing && existing.status !== "left" ? (
                <div className="mt-4 rounded-[14px] border border-info/40 bg-info-soft p-4">
                  <p className="text-base font-semibold text-info">{t("existsTitle")}</p>
                  <p className="mt-1 text-base text-text">
                    {existing.seatLabel
                      ? t("existsBody", { name: existing.name, seat: existing.seatLabel, date: existing.endDate ? formatDay(existing.endDate, locale) : "—" })
                      : t("existsBodyNoSeat", { name: existing.name, date: existing.endDate ? formatDay(existing.endDate, locale) : "—" })}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button onClick={startRenew}>
                      <RefreshCw aria-hidden />
                      {t("renewInstead")}
                    </Button>
                    <Link href={`/students/${existing.id}`} onClick={() => onOpenChange(false)} className={buttonVariants({ variant: "secondary" })}>
                      {t("viewProfile")}
                    </Link>
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {step === "details" ? (
            <section className="space-y-5">
              {existing?.status === "left" ? (
                <div className="rounded-[14px] bg-info-soft p-4 text-info">
                  <p className="text-base font-semibold">{t("returningTitle", { name: existing.name })}</p>
                  <p className="text-sm">{t("returningBody")}</p>
                </div>
              ) : null}
              <div>
                <label htmlFor="admit-name" className="mb-2 block text-sm font-semibold text-text-2">
                  {t("nameLabel")}
                </label>
                <Input
                  id="admit-name"
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="words"
                  placeholder={t("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={error === t("nameRequired")}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-text-2">{t("genderLabel")}</p>
                <ChoiceGroup
                  label={t("genderLabel")}
                  columns={3}
                  value={gender}
                  onChange={setGender}
                  options={[
                    { value: "male", label: t("male") },
                    { value: "female", label: t("female") },
                    { value: "other", label: t("other") },
                  ]}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold text-text-2">{t("examLabel")}</p>
                <div className="flex flex-wrap gap-2">
                  {[...EXAMS, "other"].map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-pressed={exam === e}
                      onClick={() => setExam(exam === e ? null : e)}
                      className={cn(
                        "h-11 rounded-full border px-4 text-sm font-semibold transition-colors",
                        exam === e ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border-strong bg-surface text-text-2",
                      )}
                    >
                      {e === "other" ? t("examOther") : e}
                    </button>
                  ))}
                </div>
                {exam === "other" ? (
                  <Input className="mt-2 h-12 text-base" placeholder={t("examOtherPlaceholder")} value={examOther} onChange={(e) => setExamOther(e.target.value)} />
                ) : null}
              </div>
              <PhotoPickers
                libraryId={data.libraryId}
                photo={photo}
                setPhoto={setPhoto}
                idProof={idProof}
                setIdProof={setIdProof}
              />
            </section>
          ) : null}

          {step === "plan" ? (
            <section className="space-y-5">
              <div>
                <h3 className="mb-2 text-lg font-semibold">{t("planTitle")}</h3>
                <div className="grid gap-2">
                  {data.plans.map((p) => {
                    const s = data.shifts.find((x) => x.id === p.shiftId);
                    const active = p.id === planId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => {
                          setPlanId(p.id);
                          setSeatId(prefill?.seatId && !existing ? prefill.seatId : undefined);
                        }}
                        className={cn(
                          "flex min-h-16 items-center justify-between gap-3 rounded-[14px] border px-4 py-3 text-left transition-[border-color,background-color] duration-150",
                          active ? "border-brand bg-brand-soft" : "border-border-strong bg-surface hover:bg-surface-2",
                        )}
                      >
                        <span className="min-w-0">
                          <span className={cn("block text-base font-semibold", active && "text-brand-soft-fg")}>{p.name}</span>
                          {s ? (
                            <span className="block text-sm text-text-2 tabular">
                              {formatMinutesShort(s.startMin, locale)} – {formatMinutesShort(s.endMin, locale)}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-lg font-bold tabular">{formatINR(p.pricePaise)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {mode === "new" || !existing?.endDate || existing.endDate < addDays(data.today, -1) ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-text-2">{t("startLabel")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: data.today, l: t("today") },
                      { v: addDays(data.today, 1), l: t("tomorrow") },
                    ].map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        aria-pressed={startDate === o.v}
                        onClick={() => setStartDate(o.v)}
                        className={cn(
                          "h-12 rounded-[12px] border text-base font-semibold",
                          startDate === o.v ? "border-brand bg-brand-soft text-brand-soft-fg" : "border-border-strong bg-surface",
                        )}
                      >
                        {o.l}
                      </button>
                    ))}
                    <label
                      className={cn(
                        "relative flex h-12 items-center justify-center rounded-[12px] border text-base font-semibold",
                        startDate !== data.today && startDate !== addDays(data.today, 1)
                          ? "border-brand bg-brand-soft text-brand-soft-fg"
                          : "border-border-strong bg-surface",
                      )}
                    >
                      {startDate !== data.today && startDate !== addDays(data.today, 1) ? formatDay(startDate, locale) : t("pickDate")}
                      <input
                        type="date"
                        className="absolute inset-0 opacity-0"
                        aria-label={t("pickDate")}
                        value={startDate}
                        min={addDays(data.today, -31)}
                        onChange={(e) => e.target.value && setStartDate(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
              {effectivePeriod ? (
                <p className="text-base text-text-2">
                  {t("planUntil", { start: formatDay(effectivePeriod.start, locale), end: formatDay(effectivePeriod.end, locale, { year: true }) })}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "seat" && want ? (
            <SeatStep
              data={data}
              seats={seatsForCheck}
              want={want}
              gender={gender}
              suggestions={suggestions}
              seatId={seatId}
              setSeatId={setSeatId}
              showMap={showMap}
              setShowMap={setShowMap}
              previousSeatId={existing?.seatId ?? null}
            />
          ) : null}

          {step === "pay" && plan ? (
            <section className="space-y-5">
              <div className="flex items-baseline justify-between rounded-[14px] bg-surface-2 px-4 py-3">
                <span className="text-base text-text-2">{t("feeFor", { plan: plan.name })}</span>
                <span className="text-2xl font-bold tabular">{formatINR(due)}</span>
              </div>
              <ChoiceGroup
                label={t("payTitle")}
                columns={1}
                value={payChoice}
                onChange={setPayChoice}
                options={[
                  { value: "full", label: t("payFull"), hint: formatINR(due) },
                  { value: "part", label: t("payPart") },
                  { value: "later", label: t("payLater") },
                ]}
              />
              {payChoice === "part" ? (
                <div>
                  <label htmlFor="admit-part" className="mb-2 block text-sm font-semibold text-text-2">
                    {t("amountReceived")}
                  </label>
                  <MoneyInput id="admit-part" autoFocus keypad={bigKeys} deleteLabel={t("deleteDigit")} valuePaise={partPaise} onChange={setPartPaise} invalid={(partPaise ?? 0) > due} />
                  {partPaise && partPaise < due ? <p className="mt-1.5 text-sm text-text-2">{t("remaining", { amount: formatINR(due - partPaise) })}</p> : null}
                </div>
              ) : null}
              {payChoice !== "later" || (mode === "new" && data.depositPaise > 0) ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-text-2">{t("methodLabel")}</p>
                  <ChoiceGroup
                    label={t("methodLabel")}
                    columns={4}
                    value={method}
                    onChange={setMethod}
                    options={(["upi", "cash", "card", "bank"] as const).map((m) => ({ value: m, label: t(m) }))}
                  />
                </div>
              ) : null}
              {mode === "new" && data.depositPaise > 0 ? (
                <div>
                  <p className="mb-2 text-sm font-semibold text-text-2">{t("depositLabel", { amount: formatINR(data.depositPaise) })}</p>
                  <ChoiceGroup
                    label={t("depositLabel", { amount: formatINR(data.depositPaise) })}
                    value={deposit}
                    onChange={setDeposit}
                    options={[
                      { value: "yes", label: t("yes") },
                      { value: "no", label: t("no") },
                    ]}
                  />
                </div>
              ) : null}
              {data.canDiscount ? (
                <div className="rounded-[14px] border border-border p-4">
                  <label className="flex min-h-10 items-center justify-between gap-3 text-base font-semibold">
                    {t("discountToggle")}
                    <input
                      type="checkbox"
                      className="size-6 accent-[var(--brand)]"
                      checked={discountOn}
                      onChange={(e) => setDiscountOn(e.target.checked)}
                    />
                  </label>
                  {discountOn ? (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label htmlFor="admit-discount" className="mb-1.5 block text-sm font-semibold text-text-2">
                          {t("discountAmount")}
                        </label>
                        <MoneyInput id="admit-discount" valuePaise={discountPaise} onChange={setDiscountPaise} />
                      </div>
                      <div>
                        <label htmlFor="admit-discount-reason" className="mb-1.5 block text-sm font-semibold text-text-2">
                          {t("discountReason")}
                        </label>
                        <Input id="admit-discount-reason" className="h-12 text-base" value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {step === "done" && result && plan ? (
            <DoneStep
              data={data}
              name={name}
              phone={phone}
              mode={mode}
              result={result}
              seatLabel={data.seats.find((s) => s.id === seatId)?.label ?? null}
              paidPaise={paying}
              onAnother={() => reset()}
              onProfile={() => onOpenChange(false)}
            />
          ) : null}

          {error ? (
            <p role="alert" className="mt-4 rounded-[12px] bg-danger-soft px-4 py-3 text-base font-medium text-danger">
              {error}
            </p>
          ) : null}
        </>
      )}
      </div>
    </Sheet>
  );
}

function PhotoPickers({
  libraryId,
  photo,
  setPhoto,
  idProof,
  setIdProof,
}: {
  libraryId: string;
  photo: { path: string | null; preview: string; uploading: boolean } | null;
  setPhoto: (p: { path: string | null; preview: string; uploading: boolean } | null) => void;
  idProof: { path: string | null; uploading: boolean } | null;
  setIdProof: (p: { path: string | null; uploading: boolean } | null) => void;
}) {
  const t = useTranslations("admit");
  const photoRef = useRef<HTMLInputElement>(null);
  const idRef = useRef<HTMLInputElement>(null);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const blob = await squareImage(file, 512, true);
      const preview = URL.createObjectURL(blob);
      setPhoto({ path: null, preview, uploading: true });
      const path = await uploadStudentFile(libraryId, blob, "photo");
      setPhoto({ path, preview, uploading: false });
    } catch {
      setPhoto(null);
      toast(t("uploadFailed"), { tone: "error" });
    }
  }
  async function onId(file: File | undefined) {
    if (!file) return;
    try {
      setIdProof({ path: null, uploading: true });
      const blob = await squareImage(file, 1400, false);
      const path = await uploadStudentFile(libraryId, blob, "id");
      setIdProof({ path, uploading: false });
    } catch {
      setIdProof(null);
      toast(t("uploadFailed"), { tone: "error" });
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className="mb-2 text-sm font-semibold text-text-2">{t("photoLabel")}</p>
        <button
          type="button"
          onClick={() => photoRef.current?.click()}
          className="flex h-28 w-full flex-col items-center justify-center gap-1.5 overflow-hidden rounded-[14px] border border-dashed border-border-strong bg-surface-2 text-sm font-semibold text-text-2"
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- local preview blob
            <img src={photo.preview} alt="" className={cn("size-20 rounded-full object-cover", photo.uploading && "opacity-50")} />
          ) : (
            <Camera className="size-7" aria-hidden />
          )}
          {photo?.uploading ? t("uploading") : photo ? t("changePhoto") : t("takePhoto")}
        </button>
        <input ref={photoRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => onPhoto(e.target.files?.[0])} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-text-2">{t("idProofLabel")}</p>
        <button
          type="button"
          onClick={() => idRef.current?.click()}
          className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border border-dashed border-border-strong bg-surface-2 text-sm font-semibold text-text-2"
        >
          {idProof && !idProof.uploading ? <CircleCheck className="size-7 text-success" aria-hidden /> : <IdCard className="size-7" aria-hidden />}
          {idProof?.uploading ? t("uploading") : t("takeIdProof")}
        </button>
        <input ref={idRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onId(e.target.files?.[0])} />
      </div>
    </div>
  );
}

function SeatStep({
  data,
  seats,
  want,
  gender,
  suggestions,
  seatId,
  setSeatId,
  showMap,
  setShowMap,
  previousSeatId,
}: {
  data: AdmitData;
  seats: AdmitData["seats"];
  want: { startMin: number; endMin: number; startDate: string; endDate: string };
  gender: "male" | "female" | "other" | null;
  suggestions: SeatInfo[];
  seatId: string | null | undefined;
  setSeatId: (id: string | null) => void;
  showMap: boolean;
  setShowMap: (v: boolean) => void;
  previousSeatId: string | null;
}) {
  const t = useTranslations("admit");
  const best = suggestions[0];
  const chosen = seatId === undefined ? best?.id ?? null : seatId;
  const zoneName = (id: string | null) => data.zones.find((z) => z.id === id)?.name ?? "";
  const girlsZones = new Set(data.zones.filter((z) => z.girlsOnly).map((z) => z.id));

  // Make the first suggestion the default choice.
  useEffect(() => {
    if (seatId === undefined && best) setSeatId(best.id);
  }, [seatId, best, setSeatId]);

  const chosenSeat = data.seats.find((s) => s.id === chosen);

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">{t("seatTitle")}</h3>
      {best ? (
        <button
          type="button"
          onClick={() => setSeatId(best.id)}
          aria-pressed={chosen === best.id}
          className={cn(
            "flex w-full items-center gap-4 rounded-[16px] border-2 p-4 text-left",
            chosen === best.id ? "border-brand bg-brand-soft" : "border-border-strong bg-surface",
          )}
        >
          <span className="grid size-16 shrink-0 place-items-center rounded-[12px] bg-brand text-xl font-bold text-brand-fg tabular">{best.label}</span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-soft-fg">
              <Star className="size-4" aria-hidden />
              {best.id === previousSeatId ? t("sameSeat") : t("bestSeat")}
            </span>
            <span className="block text-lg font-semibold">{t("zoneSeat", { zone: zoneName(best.zoneId), label: best.label })}</span>
            {best.tags.length ? <span className="block text-sm text-text-2">{best.tags.join(" · ")}</span> : null}
          </span>
        </button>
      ) : (
        <p className="rounded-[14px] bg-warning-soft px-4 py-3 text-base font-medium text-warning">{t("noFreeSeat")}</p>
      )}

      {suggestions.length > 1 ? (
        <div>
          <p className="mb-2 text-sm font-semibold text-text-2">{t("otherSeats")}</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(1, 7).map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={chosen === s.id}
                onClick={() => setSeatId(s.id)}
                className={cn(
                  "h-12 min-w-14 rounded-[12px] border px-3 text-base font-bold tabular",
                  chosen === s.id ? "border-brand bg-brand text-brand-fg" : "border-border-strong bg-surface",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setShowMap(!showMap)}>
          {showMap ? t("hideMap") : t("pickOnMap")}
        </Button>
        <Button variant={chosen === null ? "soft" : "ghost"} onClick={() => setSeatId(null)} aria-pressed={chosen === null}>
          {t("noSeat")}
        </Button>
      </div>

      {showMap ? (
        <div className="space-y-3">
          {data.zones
            .map((z) => ({ z, list: seats.filter((s) => s.zoneId === z.id) }))
            .filter(({ list }) => list.length)
            .map(({ z, list }) => {
              const cols = Math.max(...list.map((s) => s.x)) + 1;
              return (
                <div key={z.id}>
                  <p className="mb-1.5 text-sm font-semibold text-text-2">{z.name}</p>
                  <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(30px, 44px))` }}>
                    {list.map((s) => {
                      const free = isSeatFree(s, want);
                      const warn = gender === "male" && s.zoneId !== null && girlsZones.has(s.zoneId);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          disabled={!free}
                          onClick={() => setSeatId(s.id)}
                          aria-label={s.label}
                          aria-pressed={chosen === s.id}
                          style={{ gridColumnStart: s.x + 1, gridRowStart: s.y + 1 }}
                          className={cn(
                            "grid aspect-square place-items-center rounded-[8px] text-xs font-bold tabular",
                            !free
                              ? "bg-surface-3 text-text-3 line-through"
                              : chosen === s.id
                                ? "bg-brand text-brand-fg ring-2 ring-brand ring-offset-2 ring-offset-surface"
                                : "border-2 border-dashed border-border-strong bg-surface",
                            warn && free && "border-warning",
                          )}
                        >
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      ) : null}

      {chosenSeat ? (
        <p className="text-base font-medium text-text">
          {t("selectedSeat", { label: chosenSeat.label })}
          {gender === "male" && chosenSeat.zoneId !== null && girlsZones.has(chosenSeat.zoneId) ? (
            <span className="ml-2 text-sm font-semibold text-warning">· {t("girlsWarning")}</span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function DoneStep({
  data,
  name,
  phone,
  mode,
  result,
  seatLabel,
  paidPaise,
  onAnother,
  onProfile,
}: {
  data: AdmitData;
  name: string;
  phone: string;
  mode: "new" | "renew";
  result: Extract<AdmitResult, { ok: true }>;
  seatLabel: string | null;
  paidPaise: number;
  onAnother: () => void;
  onProfile: () => void;
}) {
  const t = useTranslations("admit");
  const locale = useLocale() as AppLocale;
  const owed = result.amountDuePaise - paidPaise;
  const message = fillTemplate(data.welcome[locale], {
    name: name.split(" ")[0],
    library: data.libraryName,
    seat: seatLabel ?? "—",
    end_date: formatDay(result.endDate, locale),
    amount: formatINR(owed),
  });
  const wa = `https://wa.me/${phoneDigits(phone)}?text=${encodeURIComponent(message)}`;

  return (
    <section className="flex flex-col items-center pt-2 pb-2 text-center">
      {seatLabel ? (
        <>
          <div className="relative grid size-28 place-items-center rounded-full bg-success-soft">
            <div className="seat-land w-16 [container-type:inline-size]">
              <SeatTile state="taken" label={seatLabel} initials={initials(name)} tabIndex={-1} aria-hidden />
            </div>
            <CircleCheck className="absolute -right-1 bottom-1 size-9 rounded-full bg-surface text-success" strokeWidth={2.2} aria-hidden />
          </div>
          <p className="mt-4 font-display text-[28px] leading-tight text-success">{t("seatFound")}</p>
        </>
      ) : (
        <div className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-11" strokeWidth={2.2} aria-hidden />
        </div>
      )}
      <h3 className={cn("text-2xl font-bold tracking-tight", seatLabel ? "mt-1" : "mt-4")}>{mode === "renew" ? t("doneRenewTitle", { name }) : t("doneTitle", { name })}</h3>
      <p className="mt-1 text-sm text-text-3 tabular">{formatMobile(phone, true)}</p>
      <dl className="mt-5 w-full divide-y divide-border rounded-[14px] border border-border text-left">
        <div className="flex items-center gap-3 px-4 py-3">
          <UserRound className="size-5 text-text-3" aria-hidden />
          <dd className="text-base font-semibold">{seatLabel ? t("doneSeat", { label: seatLabel }) : t("doneNoSeat")}</dd>
        </div>
        <div className="px-4 py-3 text-base">{t("donePlan", { start: formatDay(result.startDate, locale), end: formatDay(result.endDate, locale, { year: true }) })}</div>
        {paidPaise > 0 && result.receiptNumber ? (
          <div className="px-4 py-3 text-base font-medium text-success">{t("donePaid", { amount: formatINR(paidPaise), receipt: result.receiptNumber })}</div>
        ) : null}
        {owed > 0 ? <div className="px-4 py-3 text-base font-medium text-warning">{t("doneDue", { amount: formatINR(owed) })}</div> : null}
      </dl>
      <div className="mt-5 flex w-full flex-col gap-2">
        <a href={wa} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "success", size: "lg", block: true })}>
          <MessageCircle aria-hidden />
          {t("sendWelcome")}
        </a>
        <Button variant="secondary" size="lg" block onClick={onAnother}>
          {t("admitAnother")}
        </Button>
        <Link href={`/students/${result.studentId}`} onClick={onProfile} className={buttonVariants({ variant: "ghost", block: true })}>
          {t("viewProfile")}
        </Link>
      </div>
    </section>
  );
}

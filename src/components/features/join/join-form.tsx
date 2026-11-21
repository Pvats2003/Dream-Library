"use client";

import { CircleCheck, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { setLocale } from "@/actions/preferences";
import { submitJoin, type JoinResult } from "@/actions/join";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { ChoiceGroup } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { formatMinutesShort, type AppLocale } from "@/lib/dates";

const EXAMS = [
  "BPSC",
  "SSC",
  "Railway",
  "Bank",
  "NEET",
  "JEE",
  "UPSC",
  "Police",
  "College",
];

export function JoinForm({
  code,
  libraryName,
  city,
  shifts,
  today,
}: {
  code: string;
  libraryName: string;
  city: string | null;
  shifts: { id: string; name: string; startMin: number; endMin: number }[];
  today: string;
}) {
  const t = useTranslations("join");
  const ta = useTranslations("admit");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(
    null,
  );
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [seat, setSeat] = useState("");
  const [lastPaid, setLastPaid] = useState("");
  const [exam, setExam] = useState<string | null>(null);
  const [error, setError] = useState<
    Exclude<JoinResult, { ok: true }>["error"] | "shiftRequired" | null
  >(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [, startLocale] = useTransition();

  function send() {
    setError(null);
    if (!name.trim()) return setError("nameRequired");
    if (digits.length !== 10) return setError("invalidPhone");
    if (shifts.length > 0 && !shiftId) return setError("shiftRequired");
    start(async () => {
      const res = await submitJoin({
        code,
        name,
        phone: digits,
        gender,
        shiftId,
        seatLabel: seat,
        lastPaidOn: lastPaid,
        examTarget: exam ?? "",
      });
      if (!res.ok) return setError(res.error);
      setDone(name.trim().split(" ")[0]);
      window.scrollTo({ top: 0 });
    });
  }

  function reset() {
    setName("");
    setDigits("");
    setGender(null);
    setShiftId(null);
    setSeat("");
    setLastPaid("");
    setExam(null);
    setDone(null);
  }

  return (
    <div className="flex min-h-dvh justify-center bg-bg">
      <main className="pt-safe w-full max-w-md px-5 pb-10">
        <div className="flex items-center justify-between pt-5">
          <div className="flex items-center gap-3">
            <LogoMark className="size-10 rounded-[12px]" />
            <div>
              <p className="text-base font-semibold">{libraryName}</p>
              {city ? <p className="text-xs text-text-3">{city}</p> : null}
            </div>
          </div>
          <Segmented
            className="w-36"
            label="Language"
            value={locale}
            onChange={(v) =>
              startLocale(async () => {
                await setLocale(v);
                router.refresh();
              })
            }
            options={[
              { value: "hi", label: "हिंदी" },
              { value: "en", label: "EN" },
            ]}
          />
        </div>

        {done ? (
          <section className="flex flex-col items-center pt-16 text-center">
            <div className="grid size-20 place-items-center rounded-full bg-success-soft text-success">
              <CircleCheck className="size-11" aria-hidden />
            </div>
            <h1 className="mt-5 text-2xl font-bold">
              {t("doneTitle", { name: done })}
            </h1>
            <p className="mt-2 text-base text-text-2">
              {t("doneBody", { library: libraryName })}
            </p>
            <Button
              variant="secondary"
              size="lg"
              className="mt-8"
              onClick={reset}
            >
              {t("another")}
            </Button>
          </section>
        ) : (
          <form
            className="space-y-6 pt-8"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {t("title")}
              </h1>
              <p className="mt-1 text-base text-text-2">
                {t("subtitle", { library: libraryName })}
              </p>
            </div>

            <Labelled label={t("name")} htmlFor="j-name">
              <Input
                id="j-name"
                autoComplete="name"
                autoCapitalize="words"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={error === "nameRequired"}
              />
            </Labelled>

            <Labelled label={t("phone")} htmlFor="j-phone">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-lg font-medium text-text-2 tabular">
                  +91
                </span>
                <Input
                  id="j-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  className="pl-14 tabular tracking-wide"
                  value={
                    digits.length > 5
                      ? `${digits.slice(0, 5)} ${digits.slice(5)}`
                      : digits
                  }
                  aria-invalid={error === "invalidPhone"}
                  onChange={(e) => {
                    let d = e.target.value.replace(/\D/g, "");
                    if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
                    if (d.length > 10 && d.startsWith("0")) d = d.slice(1);
                    setDigits(d.slice(0, 10));
                  }}
                />
              </div>
            </Labelled>

            <Labelled label={t("gender")}>
              <ChoiceGroup
                label={t("gender")}
                columns={3}
                value={gender}
                onChange={setGender}
                options={[
                  { value: "male", label: ta("male") },
                  { value: "female", label: ta("female") },
                  { value: "other", label: ta("other") },
                ]}
              />
            </Labelled>

            {shifts.length > 0 ? (
              <Labelled label={t("shift")}>
                <ChoiceGroup
                  label={t("shift")}
                  columns={1}
                  value={shiftId}
                  onChange={setShiftId}
                  options={shifts.map((s) => ({
                    value: s.id,
                    label: s.name,
                    hint: `${formatMinutesShort(s.startMin, locale)} – ${formatMinutesShort(s.endMin, locale)}`,
                  }))}
                />
              </Labelled>
            ) : null}

            <Labelled label={t("seat")} htmlFor="j-seat">
              <Input
                id="j-seat"
                autoCapitalize="characters"
                placeholder={t("seatHint")}
                className="w-full max-w-56 uppercase"
                maxLength={12}
                value={seat}
                onChange={(e) => setSeat(e.target.value.toUpperCase())}
              />
            </Labelled>

            <Labelled
              label={t("lastPaid")}
              optional={t("optional")}
              htmlFor="j-paid"
              hint={t("lastPaidHint")}
            >
              <Input
                id="j-paid"
                type="date"
                className="w-56"
                max={today}
                value={lastPaid}
                onChange={(e) => setLastPaid(e.target.value)}
              />
            </Labelled>

            <Labelled label={t("exam")} optional={t("optional")}>
              <div className="flex flex-wrap gap-2">
                {EXAMS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-pressed={exam === e}
                    onClick={() => setExam(exam === e ? null : e)}
                    className={cn(
                      "h-11 rounded-full border px-4 text-sm font-semibold",
                      exam === e
                        ? "border-brand bg-brand-soft text-brand-soft-fg"
                        : "border-border-strong bg-surface text-text-2",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </Labelled>

            {error ? (
              <p
                role="alert"
                className="rounded-[12px] bg-danger-soft px-4 py-3 text-base font-medium text-danger"
              >
                {t(error)}
              </p>
            ) : null}

            <Button type="submit" size="lg" block disabled={pending}>
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : null}
              {pending ? t("sending") : t("send")}
            </Button>
            <p className="flex items-center justify-center gap-1.5 text-sm text-text-3">
              <Lock className="size-4" aria-hidden />
              {t("privacy")}
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

function Labelled({
  label,
  optional,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  optional?: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-2 block text-base font-semibold">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-text-3">{optional}</span>
        ) : null}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-sm text-text-3">{hint}</p> : null}
    </div>
  );
}

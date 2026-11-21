"use client";

import { BellRing, CircleCheck, EllipsisVertical, IndianRupee, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { logReminder, quickRenew, snoozeInvoice } from "@/actions/fees";
import { EmptyState } from "@/components/patterns/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { EndingPlan, OpenInvoice } from "@/lib/data/fees";
import { daysBetween, formatDay, type AppLocale } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { buildReminder } from "@/lib/reminders";
import type { TemplateKey } from "@/lib/templates";
import { waLink } from "@/lib/whatsapp";
import { RecordPaymentSheet, type PayTarget } from "./record-payment-sheet";
import { SwipeRow } from "./swipe-row";

const HINT_KEY = "libraryos:swipe-hint-seen";

export function FeesInbox({
  invoices,
  ending,
  snoozed,
  today,
  templates,
  libraryName,
  upiId,
  showTotal,
}: {
  invoices: OpenInvoice[];
  ending: EndingPlan[];
  snoozed: number;
  today: string;
  templates: Record<TemplateKey, string>;
  libraryName: string;
  upiId: string | null;
  showTotal: boolean;
}) {
  const t = useTranslations("fees");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pay, setPay] = useState<PayTarget | null>(null);
  const [snoozeFor, setSnoozeFor] = useState<OpenInvoice | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState<OpenInvoice[] | null>(null);
  const [busy, start] = useTransition();
  // One-time tip about the swipe shortcuts. Shown as a floating note so the
  // list never jumps under someone's finger.
  useEffect(() => {
    if (invoices.length === 0) return;
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      return;
    }
    const id = setTimeout(() => toast(t("swipeHint")), 600);
    return () => clearTimeout(id);
  }, [invoices.length, t]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const ctx = { today, locale, libraryName, origin, templates };

  function remind(inv: OpenInvoice) {
    const { key, text } = buildReminder(
      { studentName: inv.studentName, seatLabel: inv.seatLabel, owedPaise: inv.owed, dueDate: inv.dueDate, payToken: inv.payToken },
      ctx,
    );
    window.open(waLink(inv.phone, text), "_blank", "noopener");
    void logReminder({ studentId: inv.studentId, invoiceId: inv.id, templateKey: key, body: text });
  }

  function remindEnding(p: EndingPlan) {
    const { key, text } = buildReminder({ studentName: p.studentName, seatLabel: p.seatLabel, owedPaise: p.pricePaise, endDate: p.endDate }, ctx);
    window.open(waLink(p.phone, text), "_blank", "noopener");
    void logReminder({ studentId: p.studentId, invoiceId: null, templateKey: key, body: text });
  }

  function renew(p: EndingPlan) {
    start(async () => {
      const res = await quickRenew(p.studentId, crypto.randomUUID());
      if (!res.ok) return void toast(t("errFailed"), { tone: "error" });
      toast(res.seatLost ? t("seatLost") : t("renewed", { name: p.studentName, date: formatDay(res.endDate, locale) }));
      router.refresh();
      // Ask for the money straight away (they can close it if paying later).
      setPay({ invoiceId: res.invoiceId, studentId: p.studentId, studentName: p.studentName, phone: p.phone, owedPaise: res.amountDuePaise });
    });
  }

  const groups = [
    { key: "overdue", title: t("overdue"), items: invoices.filter((i) => i.dueDate < today), tone: "text-danger" },
    { key: "today", title: t("dueToday"), items: invoices.filter((i) => i.dueDate === today), tone: "text-warning" },
    { key: "week", title: t("thisWeek"), items: invoices.filter((i) => i.dueDate > today), tone: "text-text-2" },
  ].filter((g) => g.items.length > 0);
  const total = invoices.reduce((n, i) => n + i.owed, 0);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <header className="flex items-end justify-between gap-4 pt-6 pb-4 lg:pt-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-[32px] lg:leading-10">{t("title")}</h1>
          {showTotal && total > 0 ? (
            <p className="mt-1 text-base text-text-2">
              {t("totalOwed")}: <span className="font-semibold text-text tabular">{formatINR(total)}</span>
            </p>
          ) : null}
        </div>
        {invoices.length > 1 ? (
          <Button
            variant={selecting ? "soft" : "secondary"}
            size="sm"
            className="h-11"
            onClick={() => {
              setSelecting(!selecting);
              setSelected([]);
            }}
          >
            {selecting ? <X aria-hidden /> : <BellRing aria-hidden />}
            {selecting ? t("selectCancel") : t("selectMany")}
          </Button>
        ) : null}
      </header>

      {groups.length === 0 && ending.length === 0 ? (
        <EmptyState icon={CircleCheck} title={t("empty")} body={t("emptyBody")} />
      ) : null}

      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`fees-${g.key}`}>
            <h2 id={`fees-${g.key}`} className={cn("mb-2 flex items-center gap-2 text-base font-semibold", g.tone)}>
              {g.title}
              <span className="rounded-full bg-surface-2 px-2 text-sm text-text-2 tabular">{g.items.length}</span>
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
              {g.items.map((inv) => {
                const late = daysBetween(inv.dueDate, today);
                const isSel = selected.includes(inv.id);
                return (
                  <li key={inv.id}>
                    <SwipeRow
                      disabled={selecting}
                      rightLabel={t("recordPaid")}
                      leftLabel={t("remind")}
                      onSwipeRight={() => setPay({ invoiceId: inv.id, studentId: inv.studentId, studentName: inv.studentName, phone: inv.phone, owedPaise: inv.owed })}
                      onSwipeLeft={() => remind(inv)}
                      onLongPress={() => setSnoozeFor(inv)}
                    >
                      <div
                        className={cn("flex gap-3 px-4 py-3", isSel && "bg-brand-soft")}
                        onClick={selecting ? (e) => !(e.target as HTMLElement).closest("input, a") && toggle(inv.id) : undefined}
                      >
                        {selecting ? (
                          <input
                            type="checkbox"
                            className="mt-3 size-6 shrink-0 accent-[var(--brand)]"
                            checked={isSel}
                            onChange={() => toggle(inv.id)}
                            aria-label={inv.studentName}
                          />
                        ) : (
                          <Avatar name={inv.studentName} />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <Link href={`/students/${inv.studentId}`} className="min-w-0 truncate text-base font-semibold hover:underline">
                              {inv.studentName}
                            </Link>
                            <span className="shrink-0 text-lg font-bold tabular">{formatINR(inv.owed)}</span>
                          </div>
                          <p className={cn("text-sm font-medium", late > 0 ? "text-danger" : "text-warning")}>
                            {late > 0 ? t("pendingSince", { days: late }) : t("dueIn", { days: -late })}
                          </p>
                          <p className="truncate text-sm text-text-2">
                            {[inv.seatLabel, formatDay(inv.dueDate, locale), inv.amountPaid > 0 ? t("partPaid", { paid: formatINR(inv.amountPaid) }) : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {!selecting ? (
                            <div className="mt-2.5 flex gap-2">
                              <Button
                                size="sm"
                                variant="success"
                                className="h-10 flex-1"
                                onClick={() => setPay({ invoiceId: inv.id, studentId: inv.studentId, studentName: inv.studentName, phone: inv.phone, owedPaise: inv.owed })}
                              >
                                <IndianRupee aria-hidden />
                                {t("recordPaid")}
                              </Button>
                              <Button size="sm" variant="secondary" className="h-10 flex-1" onClick={() => remind(inv)}>
                                <MessageCircle aria-hidden />
                                {t("remind")}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-10 w-10 px-0" aria-label={t("moreActions")} onClick={() => setSnoozeFor(inv)}>
                                <EllipsisVertical aria-hidden />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </SwipeRow>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {ending.length > 0 ? (
          <section aria-labelledby="fees-ending">
            <h2 id="fees-ending" className="mb-2 flex items-center gap-2 text-base font-semibold text-info">
              {t("endingSoon")}
              <span className="rounded-full bg-surface-2 px-2 text-sm text-text-2 tabular">{ending.length}</span>
            </h2>
            <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-border bg-surface">
              {ending.map((p) => (
                <li key={p.subscriptionId} className="flex gap-3 px-4 py-3">
                  <Avatar name={p.studentName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <Link href={`/students/${p.studentId}`} className="min-w-0 truncate text-base font-semibold hover:underline">
                        {p.studentName}
                      </Link>
                      <span className="shrink-0 text-base font-semibold text-text-2 tabular">{formatINR(p.pricePaise)}</span>
                    </div>
                    <p className="text-sm font-medium text-info">{t("endsIn", { days: Math.max(0, daysBetween(today, p.endDate)) })}</p>
                    <p className="truncate text-sm text-text-2">{[p.planName, p.seatLabel, formatDay(p.endDate, locale)].filter(Boolean).join(" · ")}</p>
                    <div className="mt-2.5 flex gap-2">
                      <Button size="sm" variant="soft" className="h-10 flex-1" disabled={busy} onClick={() => renew(p)}>
                        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />}
                        {t("renew")}
                      </Button>
                      <Button size="sm" variant="secondary" className="h-10 flex-1" onClick={() => remindEnding(p)}>
                        <MessageCircle aria-hidden />
                        {t("remind")}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {snoozed > 0 ? <p className="text-center text-sm text-text-3">{t("snoozedCount", { count: snoozed })}</p> : null}
      </div>

      {selecting ? (
        <div className="pb-safe fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface px-4 py-3 shadow-[var(--shadow-sheet)] lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <span className="flex-1 text-base font-semibold">{t("selectedCount", { count: selected.length })}</span>
            <Button
              size="lg"
              disabled={selected.length === 0}
              onClick={() => {
                setBatch(invoices.filter((i) => selected.includes(i.id)));
                setSelecting(false);
                setSelected([]);
              }}
            >
              <BellRing aria-hidden />
              {t("startReminders")}
            </Button>
          </div>
        </div>
      ) : null}

      <RecordPaymentSheet target={pay} onClose={() => setPay(null)} upiId={upiId} libraryName={libraryName} receiptTemplate={templates.receipt} />
      <SnoozeSheet
        inv={snoozeFor}
        onClose={() => setSnoozeFor(null)}
        onSnooze={(days) => {
          const inv = snoozeFor!;
          setSnoozeFor(null);
          start(async () => {
            const res = await snoozeInvoice(inv.id, days);
            if (!res.ok) return void toast(t("errFailed"), { tone: "error" });
            toast(t("snoozed", { name: inv.studentName, days }));
            router.refresh();
          });
        }}
      />
      <BatchRemind items={batch} onClose={() => setBatch(null)} onRemind={remind} />
    </div>
  );
}

function SnoozeSheet({ inv, onClose, onSnooze }: { inv: OpenInvoice | null; onClose: () => void; onSnooze: (days: number) => void }) {
  const t = useTranslations("fees");
  const ta = useTranslations("admit");
  return (
    <Sheet open={inv !== null} onOpenChange={(o) => !o && onClose()} title={inv ? t("snoozeTitle", { name: inv.studentName }) : ""} closeLabel={ta("close")}>
      <div className="grid gap-2 pb-2">
        {[1, 3, 7].map((d) => (
          <Button key={d} variant="secondary" size="lg" block onClick={() => onSnooze(d)}>
            {t("snoozeDays", { days: d })}
          </Button>
        ))}
      </div>
    </Sheet>
  );
}

/** Browsers block opening many WhatsApp chats at once, so: one tap per person. */
function BatchRemind({ items, onClose, onRemind }: { items: OpenInvoice[] | null; onClose: () => void; onRemind: (i: OpenInvoice) => void }) {
  const t = useTranslations("fees");
  const ta = useTranslations("admit");
  const [step, setStep] = useState(0);
  const [key, setKey] = useState<OpenInvoice[] | null>(null);
  if (items !== key) {
    setKey(items);
    setStep(0);
  }
  if (!items) return null;
  const current = items[step];
  const finished = step >= items.length;
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      title={t("batchTitle")}
      description={finished ? undefined : t("batchStep", { step: step + 1, total: items.length })}
      closeLabel={ta("close")}
    >
      {finished ? (
        <div className="flex flex-col items-center py-6 text-center">
          <CircleCheck className="size-12 text-success" aria-hidden />
          <p className="mt-3 text-lg font-semibold">{t("batchDone")}</p>
          <Button className="mt-5" onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          <div className="flex items-center gap-3 rounded-[14px] border border-border p-4">
            <Avatar name={current.studentName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold">{current.studentName}</p>
              <p className="text-base text-text-2 tabular">{formatINR(current.owed)}</p>
            </div>
          </div>
          <Button
            variant="success"
            size="lg"
            block
            onClick={() => {
              onRemind(current);
              setStep(step + 1);
            }}
          >
            <MessageCircle aria-hidden />
            {t("sendTo", { name: current.studentName.split(" ")[0] })}
          </Button>
          <Button variant="ghost" block onClick={() => setStep(step + 1)}>
            {t("nextOne")}
          </Button>
        </div>
      )}
    </Sheet>
  );
}

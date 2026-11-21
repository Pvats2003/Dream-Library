/**
 * Checking a student's self-filled request before the owner approves it.
 * Pure logic so it can be unit-tested; the database re-checks everything.
 */
import { planPeriod } from "@/lib/dates";
import { isSeatFree, type SeatInfo } from "@/lib/seats";

export type JoinRequest = {
  id: string;
  name: string;
  phone: string;
  gender: "male" | "female" | "other" | null;
  shiftId: string | null;
  seatLabel: string | null;
  lastPaidOn: string | null;
  examTarget: string | null;
  createdAt: string;
};

export type Problem = "phoneExists" | "noShift" | "noPlan" | "noSeat" | "seatUnknown" | "seatTaken" | "noDate" | "planEnded";

export type PlanLite = { id: string; shiftId: string; months: number | null; days: number | null; pricePaise: number };
export type ShiftLite = { id: string; startMin: number; endMin: number };

export type Proposal = {
  planId: string | null;
  seatId: string | null;
  startDate: string;
  endDate: string | null;
  problems: Problem[];
};

/** The plan to suggest for a shift: its 1-month plan, else its first plan. */
export function defaultPlanFor(shiftId: string | null, plans: PlanLite[]): PlanLite | null {
  if (!shiftId) return null;
  const forShift = plans.filter((p) => p.shiftId === shiftId);
  return forShift.find((p) => p.months === 1) ?? forShift[0] ?? null;
}

export function periodFor(plan: PlanLite, startDate: string) {
  return planPeriod(startDate, plan.months ? { months: plan.months } : { days: plan.days ?? 30 });
}

export function analyzeRequest(
  r: JoinRequest,
  ctx: { plans: PlanLite[]; shifts: ShiftLite[]; seats: SeatInfo[]; existingPhones: Set<string>; today: string },
): Proposal {
  const problems: Problem[] = [];
  if (ctx.existingPhones.has(r.phone)) problems.push("phoneExists");

  const plan = defaultPlanFor(r.shiftId, ctx.plans);
  if (!r.shiftId) problems.push("noShift");
  else if (!plan) problems.push("noPlan");

  if (!r.lastPaidOn) problems.push("noDate");
  const startDate = r.lastPaidOn ?? ctx.today;
  const period = plan ? periodFor(plan, startDate) : null;
  if (period && period.end < ctx.today) problems.push("planEnded");

  let seatId: string | null = null;
  const shift = ctx.shifts.find((s) => s.id === plan?.shiftId);
  if (!r.seatLabel) {
    problems.push("noSeat");
  } else {
    const label = r.seatLabel.trim().toUpperCase().replace(/[\s-]/g, "");
    const seat = ctx.seats.find((s) => s.label.toUpperCase().replace(/[\s-]/g, "") === label);
    if (!seat || !seat.isActive) problems.push("seatUnknown");
    else if (shift && period && !isSeatFree(seat, { startMin: shift.startMin, endMin: shift.endMin, startDate: period.start, endDate: period.end })) {
      problems.push("seatTaken");
    } else seatId = seat.id;
  }

  return { planId: plan?.id ?? null, seatId, startDate, endDate: period?.end ?? null, problems };
}

/**
 * Two requests in the same batch can't both take one seat: only the first
 * (oldest) keeps it clean; later ones get "seatTaken".
 */
export function resolveBatch(items: { request: JoinRequest; proposal: Proposal }[]) {
  const claimed = new Set<string>();
  return [...items]
    .sort((a, b) => a.request.createdAt.localeCompare(b.request.createdAt))
    .map(({ request, proposal }) => {
      if (proposal.seatId && claimed.has(proposal.seatId)) {
        return { request, proposal: { ...proposal, seatId: null, problems: [...proposal.problems, "seatTaken" as const] } };
      }
      if (proposal.seatId) claimed.add(proposal.seatId);
      return { request, proposal };
    });
}

import { describe, expect, it } from "vitest";
import { analyzeRequest, resolveBatch, type JoinRequest } from "@/lib/requests";
import type { SeatInfo } from "@/lib/seats";

const today = "2026-11-21";
const plans = [
  { id: "pm", shiftId: "morning", months: 1, days: null, pricePaise: 60000 },
  { id: "pmq", shiftId: "morning", months: 3, days: null, pricePaise: 165000 },
];
const shifts = [{ id: "morning", startMin: 360, endMin: 720 }];
const seat = (label: string, extra: Partial<SeatInfo> = {}): SeatInfo => ({
  id: label, label, zoneId: null, x: 0, y: 0, isActive: true, tags: [], bookings: [], ...extra,
});
const base: JoinRequest = {
  id: "r1", name: "Rahul", phone: "+919800000001", gender: "male", shiftId: "morning",
  seatLabel: "a-1", lastPaidOn: "2026-11-10", examTarget: null, createdAt: "2026-11-21T05:00:00Z",
};
const ctx = (extra = {}) => ({ plans, shifts, seats: [seat("A1"), seat("A2")], existingPhones: new Set<string>(), today, ...extra });

describe("analyzeRequest", () => {
  it("a complete request is clean, with the monthly plan and their seat", () => {
    expect(analyzeRequest(base, ctx())).toEqual({ planId: "pm", seatId: "A1", startDate: "2026-11-10", endDate: "2026-12-09", problems: [] });
  });

  it("flags a number that is already a student", () => {
    expect(analyzeRequest(base, ctx({ existingPhones: new Set([base.phone]) })).problems).toContain("phoneExists");
  });

  it("flags a seat that does not exist or is taken", () => {
    expect(analyzeRequest({ ...base, seatLabel: "Z9" }, ctx()).problems).toContain("seatUnknown");
    const busy = seat("A1", { bookings: [{ startMin: 360, endMin: 720, startDate: "2026-11-01", endDate: "2026-11-30" }] });
    expect(analyzeRequest(base, ctx({ seats: [busy] })).problems).toContain("seatTaken");
  });

  it("flags missing date, shift and seat", () => {
    const r = analyzeRequest({ ...base, lastPaidOn: null, shiftId: null, seatLabel: null }, ctx());
    expect(r.problems).toEqual(expect.arrayContaining(["noDate", "noShift", "noSeat"]));
    expect(r.startDate).toBe(today);
  });

  it("flags a plan that has already ended", () => {
    expect(analyzeRequest({ ...base, lastPaidOn: "2026-10-01" }, ctx()).problems).toContain("planEnded");
  });
});

describe("resolveBatch", () => {
  it("only the earliest request keeps a seat two students both claimed", () => {
    const a = { request: { ...base, id: "a", createdAt: "2026-11-21T05:00:00Z" }, proposal: analyzeRequest(base, ctx()) };
    const b = { request: { ...base, id: "b", phone: "+919800000002", createdAt: "2026-11-21T06:00:00Z" }, proposal: analyzeRequest(base, ctx()) };
    const out = resolveBatch([b, a]);
    expect(out.find((x) => x.request.id === "a")!.proposal.problems).toEqual([]);
    expect(out.find((x) => x.request.id === "b")!.proposal.problems).toContain("seatTaken");
  });
});

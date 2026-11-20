import { describe, expect, it } from "vitest";
import { isSeatFree, suggestSeats, type SeatInfo } from "@/lib/seats";

const MORNING = { startMin: 360, endMin: 720 };
const EVENING = { startMin: 720, endMin: 1080 };
const FULL = { startMin: 360, endMin: 1380 };
const DEC = { startDate: "2026-12-01", endDate: "2026-12-31" };

function seat(label: string, extra: Partial<SeatInfo> = {}): SeatInfo {
  return { id: label, label, zoneId: "hall", x: Number(label.slice(1)) - 1, y: 0, isActive: true, tags: [], bookings: [], ...extra };
}

describe("isSeatFree", () => {
  const morningTaken = seat("A1", { bookings: [{ ...MORNING, ...DEC }] });

  it("lets Morning and Evening share a seat", () => {
    expect(isSeatFree(morningTaken, { ...EVENING, ...DEC })).toBe(true);
  });

  it("blocks Full Day if any shift is taken", () => {
    expect(isSeatFree(morningTaken, { ...FULL, ...DEC })).toBe(false);
  });

  it("frees the seat the day after a plan ends", () => {
    expect(isSeatFree(morningTaken, { ...MORNING, startDate: "2027-01-01", endDate: "2027-01-31" })).toBe(true);
    expect(isSeatFree(morningTaken, { ...MORNING, startDate: "2026-12-31", endDate: "2027-01-30" })).toBe(false);
  });

  it("never offers a closed seat", () => {
    expect(isSeatFree(seat("A2", { isActive: false }), { ...MORNING, ...DEC })).toBe(false);
  });
});

describe("suggestSeats", () => {
  const want = { ...MORNING, ...DEC };

  it("keeps the same seat on renewal", () => {
    const seats = [seat("A1"), seat("A2"), seat("A3")];
    expect(suggestSeats({ seats, zones: [], want, previousSeatId: "A3" })[0].label).toBe("A3");
  });

  it("puts friends next to each other", () => {
    const seats = [seat("A1"), seat("A2"), seat("A5", { bookings: [{ ...FULL, ...DEC }] }), seat("A6")];
    expect(suggestSeats({ seats, zones: [], want, nearSeatId: "A5" })[0].label).toBe("A6");
  });

  it("never suggests the girls section to a male student", () => {
    const seats = [seat("G1", { zoneId: "girls" }), seat("A1", { bookings: [{ ...FULL, ...DEC }] })];
    const zones = [{ id: "girls", girlsOnly: true }];
    expect(suggestSeats({ seats, zones, want, gender: "male" })).toEqual([]);
    expect(suggestSeats({ seats, zones, want, gender: "female" })[0].label).toBe("G1");
  });

  it("fills half-used seats first for part-day shifts", () => {
    const seats = [seat("A1"), seat("A2", { bookings: [{ ...EVENING, ...DEC }] })];
    expect(suggestSeats({ seats, zones: [], want })[0].label).toBe("A2");
  });

  it("uses natural label order", () => {
    const seats = [seat("A10"), seat("A2"), seat("A1")];
    expect(suggestSeats({ seats, zones: [], want }).map((s) => s.label)).toEqual(["A1", "A2", "A10"]);
  });
});

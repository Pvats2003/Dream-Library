import { describe, expect, it } from "vitest";
import { draftFromSeats, duplicateLabels, generateSeats, toLayoutPayload, type ZoneDraft } from "@/lib/layout";

const hall: ZoneDraft = {
  key: "1", name: "AC Hall", rows: 5, cols: 8, aisleAfter: 4, labelStyle: "rows", prefix: "A",
  removed: [], girlsOnly: false, ac: true, cabin: false,
};

describe("generateSeats", () => {
  it("labels rows A–E and seats 1–8, with a walkway after seat 4", () => {
    const seats = generateSeats(hall);
    expect(seats).toHaveLength(40);
    expect(seats[0]).toMatchObject({ label: "A1", x: 0, y: 0 });
    expect(seats.find((s) => s.label === "A5")).toMatchObject({ x: 5 }); // x=4 is the walkway
    expect(seats.at(-1)).toMatchObject({ label: "E8", x: 8, y: 4 });
  });

  it("skips removed seats but keeps the others' labels", () => {
    const seats = generateSeats({ ...hall, removed: ["0-1"] });
    expect(seats.map((s) => s.label)).not.toContain("A2");
    expect(seats.map((s) => s.label)).toContain("A3");
  });

  it("numbers prefix-style zones continuously", () => {
    const girls: ZoneDraft = { ...hall, name: "Girls", rows: 2, cols: 6, aisleAfter: null, labelStyle: "prefix", prefix: "G", removed: ["0-2"] };
    expect(generateSeats(girls).map((s) => s.label)).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10", "G11"]);
  });
});

describe("duplicates and payload", () => {
  it("catches two halls both starting at A1", () => {
    expect(duplicateLabels([hall, { ...hall, key: "2", name: "Hall 2", rows: 1, cols: 2 }])).toEqual(["A1", "A2"]);
  });

  it("builds the save payload with zone attributes", () => {
    const [z] = toLayoutPayload([hall]);
    expect(z.attributes).toEqual({ ac: true, girls_only: false, cabin: false });
    expect(z.seats).toHaveLength(40);
  });
});

describe("draftFromSeats", () => {
  it("reads a generated hall back exactly", () => {
    const seats = generateSeats({ ...hall, removed: ["2-6"] });
    const draft = draftFromSeats("x", "AC Hall", { ac: true }, seats);
    expect(draft).toMatchObject({ rows: 5, cols: 8, aisleAfter: 4, labelStyle: "rows", prefix: "A", removed: ["2-6"], ac: true });
    expect(generateSeats(draft).map((s) => s.label)).toEqual(seats.map((s) => s.label));
  });

  it("reads a prefix zone back", () => {
    const seats = generateSeats({ ...hall, rows: 2, cols: 4, aisleAfter: null, labelStyle: "prefix", prefix: "CB" });
    const draft = draftFromSeats("x", "Cabins", { cabin: true }, seats);
    expect(draft).toMatchObject({ labelStyle: "prefix", prefix: "CB", rows: 2, cols: 4, cabin: true });
  });
});

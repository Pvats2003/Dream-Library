import { describe, expect, it } from "vitest";
import { formatMobile, normalizeIndianMobile } from "@/lib/phone";

describe("normalizeIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91-98765-43210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
  ])("%s → %s", (input, out) => {
    expect(normalizeIndianMobile(input)).toBe(out);
  });

  it.each(["12345", "5876543210", "98765432101", "", "abcdefghij"])("rejects %s", (input) => {
    expect(normalizeIndianMobile(input)).toBeNull();
  });

  it("formats for display", () => {
    expect(formatMobile("+919876543210")).toBe("98765 43210");
    expect(formatMobile("+919876543210", true)).toBe("+91 98765 43210");
  });
});

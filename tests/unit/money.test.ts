import { describe, expect, it } from "vitest";
import { amountInWords, formatINR, numberToWords, parseRupees, rupees } from "@/lib/money";

describe("formatINR", () => {
  it("uses Indian grouping", () => {
    expect(formatINR(rupees(120000))).toBe("₹1,20,000");
    expect(formatINR(rupees(600))).toBe("₹600");
    expect(formatINR(rupees(10000000))).toBe("₹1,00,00,000");
    expect(formatINR(0)).toBe("₹0");
  });

  it("shows paise only when present", () => {
    expect(formatINR(9950)).toBe("₹99.50");
    expect(formatINR(9905)).toBe("₹99.05");
  });

  it("marks reversals and optional plus sign", () => {
    expect(formatINR(-60000)).toBe("−₹600");
    expect(formatINR(60000, { sign: true })).toBe("+₹600");
  });

  it("refuses floats", () => {
    expect(() => formatINR(10.5)).toThrow();
  });
});

describe("parseRupees", () => {
  it("accepts what people type", () => {
    expect(parseRupees("1,200")).toBe(120000);
    expect(parseRupees("₹ 600")).toBe(60000);
    expect(parseRupees("99.5")).toBe(9950);
    expect(parseRupees("99.05")).toBe(9905);
    expect(parseRupees("0")).toBe(0);
  });

  it("rejects junk", () => {
    expect(parseRupees("")).toBeNull();
    expect(parseRupees("-5")).toBeNull();
    expect(parseRupees("1.234")).toBeNull();
    expect(parseRupees("abc")).toBeNull();
  });
});

describe("amount in words", () => {
  it("speaks lakh and crore in English", () => {
    expect(numberToWords(120000, "en")).toBe("One Lakh Twenty Thousand");
    expect(numberToWords(10000000, "en")).toBe("One Crore");
    expect(numberToWords(12345678, "en")).toBe(
      "One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight",
    );
    expect(amountInWords(rupees(600), "en")).toBe("Rupees Six Hundred Only");
    expect(amountInWords(55050, "en")).toBe("Rupees Five Hundred Fifty and Fifty Paise Only");
  });

  it("speaks Hindi", () => {
    expect(amountInWords(rupees(120000), "hi")).toBe("एक लाख बीस हज़ार रुपये मात्र");
    expect(amountInWords(rupees(3300), "hi")).toBe("तीन हज़ार तीन सौ रुपये मात्र");
    expect(numberToWords(99, "hi")).toBe("निन्यानवे");
    expect(numberToWords(0, "hi")).toBe("शून्य");
    expect(amountInWords(50050, "hi")).toBe("पाँच सौ रुपये और पचास पैसे मात्र");
  });
});

import { describe, expect, it } from "vitest";
import { fillTemplate } from "@/lib/templates";
import { upiLink } from "@/lib/upi";
import { waLink } from "@/lib/whatsapp";

describe("upiLink", () => {
  it("builds a standard upi:// link with the exact amount", () => {
    expect(upiLink({ upiId: "dream@ybl", payeeName: "Dream Library", amountPaise: 60000, note: "Fees Rahul" })).toBe(
      "upi://pay?pa=dream@ybl&pn=Dream%20Library&am=600.00&cu=INR&tn=Fees%20Rahul",
    );
  });

  it("keeps paise", () => {
    expect(upiLink({ upiId: "a.b@okaxis", payeeName: "X", amountPaise: 9950 })).toContain("am=99.50");
  });

  it("refuses a bad UPI ID or amount", () => {
    expect(() => upiLink({ upiId: "not-an-id", payeeName: "X", amountPaise: 100 })).toThrow();
    expect(() => upiLink({ upiId: "a@ybl", payeeName: "X", amountPaise: 0 })).toThrow();
  });
});

describe("waLink and templates", () => {
  it("opens a chat with the number and the message typed in, Hindi included", () => {
    const text = fillTemplate("Namaste {name} ji, fees {amount} baaki hai. {upi_link}", {
      name: "राहुल",
      amount: "₹600",
      upi_link: "https://x.app/p/abc",
    });
    const link = waLink("+919876543210", text);
    expect(link.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe("Namaste राहुल ji, fees ₹600 baaki hai. https://x.app/p/abc");
  });

  it("leaves no raw {variables} when one is missing", () => {
    expect(fillTemplate("Seat {seat}, till {end_date}.", { seat: "A1" })).toBe("Seat A1, till.");
  });
});

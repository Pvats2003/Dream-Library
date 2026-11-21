/**
 * UPI payment links (NPCI deep-link format). Opening one on a phone shows
 * the person's UPI apps (PhonePe, Google Pay, Paytm…) with the amount and
 * the library's UPI ID filled in. The same string is what the QR encodes.
 */
import type { Paise } from "./money";

export const UPI_ID_RE = /^[A-Za-z0-9._-]{2,200}@[A-Za-z]{2,64}$/;

export function upiLink(opts: { upiId: string; payeeName: string; amountPaise: Paise; note?: string }): string {
  if (!UPI_ID_RE.test(opts.upiId)) throw new Error("Invalid UPI ID");
  if (!Number.isSafeInteger(opts.amountPaise) || opts.amountPaise <= 0) throw new Error("Invalid amount");
  const rupees = `${Math.floor(opts.amountPaise / 100)}.${String(opts.amountPaise % 100).padStart(2, "0")}`;
  const params = [
    ["pa", opts.upiId],
    ["pn", opts.payeeName.slice(0, 50)],
    ["am", rupees],
    ["cu", "INR"],
    ...(opts.note ? [["tn", opts.note.slice(0, 50)]] : []),
  ];
  // encodeURIComponent keeps "@" encoded as %40, which some UPI apps reject; keep it literal.
  return `upi://pay?${params.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, "@")}`).join("&")}`;
}

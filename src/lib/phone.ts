/** Indian mobile numbers, stored as +91XXXXXXXXXX. */

const MOBILE_RE = /^[6-9]\d{9}$/;

/**
 * Accepts what people actually type: "98765 43210", "+91-98765-43210",
 * "09876543210", "919876543210". Returns +919876543210 or null.
 */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return MOBILE_RE.test(digits) ? `+91${digits}` : null;
}

/** +919876543210 → "98765 43210" (with country code: "+91 98765 43210"). */
export function formatMobile(e164: string, withCode = false): string {
  const local = e164.replace(/^\+91/, "");
  const pretty = `${local.slice(0, 5)} ${local.slice(5)}`;
  return withCode ? `+91 ${pretty}` : pretty;
}

/** Digits only, for wa.me and tel: links. */
export function phoneDigits(e164: string): string {
  return e164.replace(/\D/g, "");
}

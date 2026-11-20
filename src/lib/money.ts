/**
 * Money is always an integer number of paise. ₹600 = 60000.
 * Display uses Indian grouping (₹1,20,000). No floats touch amounts.
 */

export type Paise = number;

function assertPaise(paise: number): void {
  if (!Number.isSafeInteger(paise)) throw new Error(`Paise must be a safe integer, got ${paise}`);
}

const groupFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,20,000 — paise shown only when not a whole rupee (₹99.50). */
export function formatINR(paise: Paise, opts: { sign?: boolean } = {}): string {
  assertPaise(paise);
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const body = groupFormatter.format(rupees) + (rem ? `.${String(rem).padStart(2, "0")}` : "");
  const sign = negative ? "−" : opts.sign && paise > 0 ? "+" : "";
  return `${sign}₹${body}`;
}

/** Number only, grouped: 1,20,000 (for inputs that show ₹ separately). */
export function formatRupeeNumber(paise: Paise): string {
  return formatINR(paise).replace("₹", "");
}

/**
 * Parse what a person typed ("1,200", "1200.5", "₹ 600") into paise.
 * Returns null for anything that isn't a clean non-negative amount.
 */
export function parseRupees(input: string): Paise | null {
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d{1,9}(\.\d{0,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function rupees(r: number): Paise {
  if (!Number.isSafeInteger(r)) throw new Error("Use whole rupees");
  return r * 100;
}

// ---------------------------------------------------------------------------
// Amount in words (Indian numbering: thousand, lakh, crore)
// ---------------------------------------------------------------------------

const EN_ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const EN_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function enBelowHundred(n: number): string {
  if (n < 20) return EN_ONES[n];
  return EN_TENS[Math.floor(n / 10)] + (n % 10 ? ` ${EN_ONES[n % 10]}` : "");
}

// Hindi numbers 0-99 are irregular, so they're a lookup table.
const HI_0_99 = (
  "शून्य एक दो तीन चार पाँच छह सात आठ नौ दस " +
  "ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस " +
  "इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस " +
  "इकतीस बत्तीस तैंतीस चौंतीस पैंतीस छत्तीस सैंतीस अड़तीस उनतालीस चालीस " +
  "इकतालीस बयालीस तैंतालीस चवालीस पैंतालीस छियालीस सैंतालीस अड़तालीस उनचास पचास " +
  "इक्यावन बावन तिरेपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ " +
  "इकसठ बासठ तिरेसठ चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर " +
  "इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर अठहत्तर उन्यासी अस्सी " +
  "इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे " +
  "इक्यानवे बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे"
).split(" ");

type Lang = "en" | "hi";

const UNITS: Record<Lang, { crore: string; lakh: string; thousand: string; hundred: string }> = {
  en: { crore: "Crore", lakh: "Lakh", thousand: "Thousand", hundred: "Hundred" },
  hi: { crore: "करोड़", lakh: "लाख", thousand: "हज़ार", hundred: "सौ" },
};

function belowHundred(n: number, lang: Lang): string {
  return lang === "en" ? enBelowHundred(n) : HI_0_99[n];
}

/** Whole number in Indian-system words, e.g. 120000 → "One Lakh Twenty Thousand". */
export function numberToWords(n: number, lang: Lang): string {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("Expected a non-negative integer");
  if (n === 0) return belowHundred(0, lang);
  const u = UNITS[lang];
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  let rest = n % 10_000_000;
  if (crore) parts.push(`${numberToWords(crore, lang)} ${u.crore}`);
  const lakh = Math.floor(rest / 100_000);
  rest %= 100_000;
  if (lakh) parts.push(`${belowHundred(lakh, lang)} ${u.lakh}`);
  const thousand = Math.floor(rest / 1000);
  rest %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand, lang)} ${u.thousand}`);
  const hundred = Math.floor(rest / 100);
  rest %= 100;
  if (hundred) parts.push(`${belowHundred(hundred, lang)} ${u.hundred}`);
  if (rest) parts.push(belowHundred(rest, lang));
  return parts.join(" ");
}

/**
 * For receipts.
 * en: "Rupees One Lakh Twenty Thousand Only" / "Rupees Five Hundred and Fifty Paise Only"
 * hi: "एक लाख बीस हज़ार रुपये मात्र" / "पाँच सौ रुपये और पचास पैसे मात्र"
 */
export function amountInWords(paise: Paise, lang: Lang): string {
  assertPaise(paise);
  if (paise < 0) throw new Error("Amount in words needs a positive amount");
  const r = Math.floor(paise / 100);
  const p = paise % 100;
  if (lang === "en") {
    const rs = `Rupees ${numberToWords(r, "en")}`;
    return p ? `${rs} and ${numberToWords(p, "en")} Paise Only` : `${rs} Only`;
  }
  const rs = `${numberToWords(r, "hi")} रुपये`;
  return p ? `${rs} और ${numberToWords(p, "hi")} पैसे मात्र` : `${rs} मात्र`;
}

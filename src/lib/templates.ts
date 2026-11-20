/**
 * WhatsApp message templates. Owners can edit these in Settings; these are
 * the starting texts. Variables: {name} {amount} {due_date} {seat} {plan}
 * {end_date} {upi_link} {library}.
 */

export type TemplateKey = "welcome" | "reminder" | "expiring" | "receipt" | "overdue";

export const DEFAULT_TEMPLATES: { key: TemplateKey; locale: "hi" | "en"; body: string }[] = [
  {
    key: "welcome",
    locale: "hi",
    body: "Namaste {name} ji, {library} mein aapka swagat hai! Aapki seat {seat} hai, plan {end_date} tak hai. Padhai ke liye shubhkamnayein.",
  },
  {
    key: "welcome",
    locale: "en",
    body: "Hi {name}, welcome to {library}! Your seat is {seat} and your plan runs till {end_date}. All the best with your studies.",
  },
  {
    key: "reminder",
    locale: "hi",
    body: "Namaste {name} ji, {library} ki fees {amount} {due_date} se baaki hai. UPI se bharne ke liye: {upi_link} — Dhanyavaad.",
  },
  {
    key: "reminder",
    locale: "en",
    body: "Hi {name}, your {library} fees of {amount} is due since {due_date}. Pay by UPI: {upi_link} — Thank you.",
  },
  {
    key: "expiring",
    locale: "hi",
    body: "Namaste {name} ji, aapka plan {end_date} ko khatam ho raha hai. Seat {seat} aapke liye rakhne ke liye {amount} jama karein: {upi_link}",
  },
  {
    key: "expiring",
    locale: "en",
    body: "Hi {name}, your plan ends on {end_date}. To keep seat {seat}, please pay {amount}: {upi_link}",
  },
  {
    key: "overdue",
    locale: "hi",
    body: "Namaste {name} ji, aapki fees {amount} kaafi din se baaki hai. Kripya jaldi jama karein, warna seat {seat} kisi aur ko di ja sakti hai. {upi_link}",
  },
  {
    key: "overdue",
    locale: "en",
    body: "Hi {name}, your fees of {amount} has been pending for a while. Please pay soon so we can keep seat {seat} for you. {upi_link}",
  },
  {
    key: "receipt",
    locale: "hi",
    body: "Namaste {name} ji, {amount} mil gaye. Dhanyavaad! Aapki rasid: {receipt_link}",
  },
  {
    key: "receipt",
    locale: "en",
    body: "Hi {name}, we received {amount}. Thank you! Your receipt: {receipt_link}",
  },
];

/** Replace {variables}; unknown or missing ones are left blank, never shown raw. */
export function fillTemplate(body: string, vars: Record<string, string | undefined>): string {
  return body
    .replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([,.!—])/g, "$1")
    .trim();
}

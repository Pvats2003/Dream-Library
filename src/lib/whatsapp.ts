import { phoneDigits } from "./phone";

/** Click-to-chat link with the message typed in, ready to send. */
export function waLink(phoneE164: string | null, text: string): string {
  const base = phoneE164 ? `https://wa.me/${phoneDigits(phoneE164)}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(text)}`;
}

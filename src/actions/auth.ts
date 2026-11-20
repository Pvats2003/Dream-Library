"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { otpSchema, phoneSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export type AuthResult = { ok: true; phone: string } | { ok: false; error: "invalidPhone" | "tooMany" | "sendFailed" | "wrongCode" };

export async function sendCode(rawPhone: string): Promise<AuthResult> {
  const parsed = phoneSchema.safeParse(rawPhone);
  if (!parsed.success) return { ok: false, error: "invalidPhone" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data });
  if (error) {
    return { ok: false, error: error.status === 429 ? "tooMany" : "sendFailed" };
  }
  return { ok: true, phone: parsed.data };
}

export async function verifyCode(rawPhone: string, code: string): Promise<AuthResult> {
  const parsed = otpSchema.safeParse({ phone: rawPhone, code });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message === "invalidPhone" ? "invalidPhone" : "wrongCode" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ phone: parsed.data.phone, token: parsed.data.code, type: "sms" });
  if (error || !data.user) {
    return { ok: false, error: error?.status === 429 ? "tooMany" : "wrongCode" };
  }
  // Remember the language they picked on the welcome screen — after the
  // response, so it doesn't slow down the first screen.
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const userId = data.user.id;
  after(async () => {
    await supabase.from("profiles").update({ locale: isLocale(chosen) ? chosen : DEFAULT_LOCALE }).eq("id", userId);
  });
  redirect("/today");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/welcome");
}

"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LOCALE_COOKIE, LOCALES } from "@/i18n/config";
import { ACTIVE_LIBRARY_COOKIE, getViewer } from "@/lib/session";
import { THEME_COOKIE } from "@/lib/theme";
import { createClient } from "@/lib/supabase/server";

const YEAR = 60 * 60 * 24 * 365;

const themeSchema = z.enum(["system", "light", "dark"]);

export async function setLocale(locale: string): Promise<void> {
  const parsed = z.enum(LOCALES).parse(locale);
  (await cookies()).set(LOCALE_COOKIE, parsed, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const viewer = await getViewer();
  if (viewer) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ locale: parsed }).eq("id", viewer.userId);
  }
  revalidatePath("/", "layout");
}

export async function setTheme(theme: string): Promise<void> {
  const parsed = themeSchema.parse(theme);
  (await cookies()).set(THEME_COOKIE, parsed, { path: "/", maxAge: YEAR, sameSite: "lax" });
  const viewer = await getViewer();
  if (viewer) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ theme: parsed }).eq("id", viewer.userId);
  }
  revalidatePath("/", "layout");
}

export async function setActiveLibrary(libraryId: string): Promise<void> {
  const id = z.uuid().parse(libraryId);
  const viewer = await getViewer();
  if (!viewer?.memberships.some((m) => m.libraryId === id)) return;
  (await cookies()).set(ACTIVE_LIBRARY_COOKIE, id, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true });
  revalidatePath("/", "layout");
}

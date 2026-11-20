export const THEME_COOKIE = "theme";
export type ThemePref = "system" | "light" | "dark";
export function isThemePref(v: unknown): v is ThemePref {
  return v === "system" || v === "light" || v === "dark";
}

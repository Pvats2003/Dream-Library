import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every text colour must be readable on the background it sits on (WCAG AA:
 * 4.5:1 for text, 3:1 for input borders and the focus ring), in BOTH themes.
 */
const css = readFileSync(join(process.cwd(), "src/styles/tokens.css"), "utf8");

function block(selectorStart: string): Record<string, string> {
  const i = css.indexOf(selectorStart);
  if (i < 0) throw new Error(`missing block ${selectorStart}`);
  const open = css.indexOf("{", i);
  let depth = 0;
  let end = open;
  for (let j = open; j < css.length; j++) {
    if (css[j] === "{") depth++;
    if (css[j] === "}") depth--;
    if (depth === 0) {
      end = j;
      break;
    }
  }
  const body = css.slice(open + 1, end);
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}

const light = block(':root,\n[data-theme="light"] {');
const dark = block('[data-theme="dark"] {');
const darkMedia = block(':root:not([data-theme="light"]) {');
const roles = block(":root,\n[data-theme] {");

function resolve(theme: Record<string, string>, name: string): string {
  let v = theme[name] ?? roles[name];
  for (let k = 0; k < 5 && v?.startsWith("var("); k++) {
    const ref = v.slice(6, -1);
    v = theme[ref] ?? roles[ref];
  }
  if (!v) throw new Error(`unknown token --${name}`);
  return v;
}

function luminance(oklch: string): number {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(oklch);
  if (!m) throw new Error(`not oklch: ${oklch}`);
  const [L, C, H] = [Number(m[1]), Number(m[2]), (Number(m[3]) * Math.PI) / 180];
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mm = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (x: number) => Math.min(1, Math.max(0, x));
  const R = clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
  const G = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
  const B = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrast(theme: Record<string, string>, fg: string, bg: string) {
  const a = luminance(resolve(theme, fg));
  const b = luminance(resolve(theme, bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const TEXT_PAIRS: [string, string][] = [
  ["text", "bg"], ["text", "surface"], ["text", "surface-2"], ["text", "surface-3"],
  ["text-2", "bg"], ["text-2", "surface"], ["text-2", "surface-2"], ["text-2", "surface-3"],
  ["text-3", "bg"], ["text-3", "surface"], ["text-3", "surface-2"],
  ["brand-fg", "brand"], ["brand-fg", "brand-hover"], ["brand-fg", "brand-press"],
  ["brand-soft-fg", "brand-soft"], ["brand", "surface"], ["brand", "bg"],
  ["accent-fg", "accent-soft"],
  ["paid-fg", "paid-soft"], ["paid-fg", "surface"], ["on-solid", "paid"],
  ["due-soon-fg", "due-soon-soft"], ["due-soon-fg", "surface"],
  ["overdue-fg", "overdue-soft"], ["overdue-fg", "surface"], ["on-solid", "overdue"],
  ["upcoming-fg", "upcoming-soft"], ["upcoming-fg", "surface"],
  ["free-fg", "free-soft"],
];
const UI_PAIRS: [string, string][] = [
  ["border-input", "surface"], ["focus", "bg"], ["focus", "surface"], ["free", "surface"],
];

for (const [name, theme] of [["light", light], ["dark", dark]] as const) {
  describe(`${name} theme contrast`, () => {
    it.each(TEXT_PAIRS)("%s on %s ≥ 4.5:1", (fg, bg) => {
      expect(contrast(theme, fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
    it.each(UI_PAIRS)("%s on %s ≥ 3:1", (fg, bg) => {
      expect(contrast(theme, fg, bg)).toBeGreaterThanOrEqual(3);
    });
  });
}

describe("dark theme is defined once in practice", () => {
  it("the 'phone is dark' block matches the 'chose dark' block exactly", () => {
    expect(darkMedia).toEqual(dark);
  });
});

import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import hi from "../../messages/hi.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  it("Hindi and English have exactly the same keys", () => {
    expect(keys(hi).sort()).toEqual(keys(en).sort());
  });

  it("has no empty strings except intentional plural blanks", () => {
    for (const [file, msgs] of [["hi", hi], ["en", en]] as const) {
      for (const k of keys(msgs)) {
        const v = k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], msgs);
        expect(String(v).trim(), `${file}:${k}`).not.toBe("");
      }
    }
  });
});

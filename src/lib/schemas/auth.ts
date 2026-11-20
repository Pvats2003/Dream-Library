import { z } from "zod";
import { normalizeIndianMobile } from "@/lib/phone";

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "invalidPhone" });
      return z.NEVER;
    }
    return n;
  });

export const otpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "wrongCode"),
});

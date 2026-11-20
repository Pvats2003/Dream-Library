import { z } from "zod";
import { phoneSchema } from "./auth";

/** Shared by the admit sheet (client) and the server action. */
export const admitSchema = z
  .object({
    clientOpId: z.uuid(),
    mode: z.enum(["new", "renew"]),
    studentId: z.uuid().optional(),
    phone: phoneSchema,
    name: z.string().trim().min(1, "nameRequired").max(120),
    gender: z.enum(["male", "female", "other"]).nullable(),
    examTarget: z.string().trim().max(60).nullable(),
    photoPath: z.string().max(200).nullable(),
    idProofPath: z.string().max(200).nullable(),
    planId: z.uuid(),
    startDate: z.iso.date(),
    seatId: z.uuid().nullable(),
    discountPaise: z.number().int().min(0).default(0),
    discountReason: z.string().trim().max(200).nullable(),
    payment: z
      .object({
        amountPaise: z.number().int().positive(),
        method: z.enum(["cash", "upi", "card", "bank"]),
        reference: z.string().trim().max(60).nullable(),
      })
      .nullable(),
    depositPaise: z.number().int().min(0).default(0),
    depositMethod: z.enum(["cash", "upi", "card", "bank"]).default("cash"),
  })
  .refine((v) => v.discountPaise === 0 || (v.discountReason ?? "").length > 0, {
    message: "discountReasonRequired",
    path: ["discountReason"],
  })
  .refine((v) => v.mode === "new" || v.studentId, { message: "studentRequired", path: ["studentId"] });

export type AdmitInput = z.input<typeof admitSchema>;

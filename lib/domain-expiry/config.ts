import { z } from "zod";
export const expiryConfigSchema = z
  .object({
    thresholds: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(6)
      .refine((items) => new Set(items).size === items.length, "Thresholds must be unique.")
      .optional(),
  })
  .strict();
export const DEFAULT_EXPIRY_THRESHOLDS = [90, 30, 7];

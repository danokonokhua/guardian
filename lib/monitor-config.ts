import { MonitorType } from "@prisma/client";
import { z } from "zod";
import { parseWith } from "@/lib/validation";

/** Phase 1B-10 monitor configuration contract. */
export const monitorConfigSchema = z.object({
  websiteId: z.string().uuid(),
  type: z.nativeEnum(MonitorType),
  enabled: z.boolean().optional().default(true),
  frequencyMinutes: z.number().int().min(1).max(1440).optional().default(5),
  config: z.record(z.string(), z.unknown()).optional().default({}),
});

export type MonitorConfigInput = z.input<typeof monitorConfigSchema>;
export type MonitorConfig = z.output<typeof monitorConfigSchema>;

/** Mutable monitor settings accepted by the management endpoint. */
export const monitorUpdateSchema = z
  .object({
    enabled: z.boolean().optional(),
    frequencyMinutes: z.number().int().min(1).max(1440).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one monitor setting is required.",
  });

export type MonitorUpdateInput = z.input<typeof monitorUpdateSchema>;

export function parseMonitorConfig(input: unknown): MonitorConfig {
  return parseWith(monitorConfigSchema, input, "monitor");
}

export function parseMonitorUpdate(input: unknown): MonitorUpdateInput {
  return parseWith(monitorUpdateSchema, input, "monitor");
}

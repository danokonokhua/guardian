import { MonitorType } from "@prisma/client";
import { z } from "zod";
import { parseWith } from "@/lib/validation";

export const performanceMonitorConfigSchema = z
  .object({
    maxResponseTimeMs: z.number().int().min(250).max(30_000).optional(),
  })
  .strict();

const safeFormIdentifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/, "formId must be a safe HTML id or name.");

const safeFormPath = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//") && !/[?#\s]/.test(value),
    "form paths must be relative paths without query strings, fragments, or whitespace.",
  );

export const formMonitorConfigSchema = z
  .object({
    formId: safeFormIdentifier,
    pagePath: safeFormPath.optional(),
    probePath: safeFormPath.optional(),
  })
  .strict();

/** Monitor configuration contract; only worker-backed types are accepted. */
export const monitorConfigSchema = z.object({
  websiteId: z.string().uuid(),
  type: z
    .nativeEnum(MonitorType)
    .refine(
      (value) =>
        value === MonitorType.UPTIME ||
        value === MonitorType.SSL ||
        value === MonitorType.SECURITY ||
        value === MonitorType.LINKS ||
        value === MonitorType.SEO ||
        value === MonitorType.PERFORMANCE ||
        value === MonitorType.FORM,
      {
        message:
          "This monitor type is not available yet. Choose UPTIME, SSL, SECURITY, LINKS, SEO, PERFORMANCE, or FORM.",
      },
    ),
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
  const parsed = parseWith(monitorConfigSchema, input, "monitor");
  if (parsed.type === MonitorType.PERFORMANCE) {
    return {
      ...parsed,
      config: parseWith(performanceMonitorConfigSchema, parsed.config, "monitor.config"),
    };
  }
  if (parsed.type === MonitorType.FORM) {
    return {
      ...parsed,
      config: parseWith(formMonitorConfigSchema, parsed.config, "monitor.config"),
    };
  }
  return parsed;
}

export function parseMonitorUpdate(input: unknown): MonitorUpdateInput {
  return parseWith(monitorUpdateSchema, input, "monitor");
}

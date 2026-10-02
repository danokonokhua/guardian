import { z } from "zod";
export const DESTINATION_CHANNELS = ["SLACK", "TEAMS", "DISCORD", "WEBHOOK"] as const;
export type DestinationChannel = (typeof DESTINATION_CHANNELS)[number];
export const destinationSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    channel: z.enum(DESTINATION_CHANNELS),
    url: z.string().min(1).max(4096),
    signingSecret: z.string().min(32).max(256).optional(),
  })
  .strict()
  .refine((value) => value.channel !== "WEBHOOK" || !!value.signingSecret, {
    message: "A webhook signing secret of at least 32 characters is required.",
  });
export const destinationUpdateSchema = z
  .object({ name: z.string().trim().min(1).max(80).optional(), enabled: z.boolean().optional() })
  .strict()
  .refine((v) => Object.keys(v).length > 0);

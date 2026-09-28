import { z } from "zod";
export const emailHealthConfigSchema = z
  .object({ domainScope: z.enum(["REGISTERED", "HOSTNAME"]).optional() })
  .strict();

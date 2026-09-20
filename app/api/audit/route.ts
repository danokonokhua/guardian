import { z } from "zod";

import { jsonResponse, withRoute } from "@/lib/api";
import { enforceAuditRateLimit } from "@/lib/audit/rate-limit";
import { runFreeAudit } from "@/lib/audit/service";
import { getPrisma } from "@/db/client";

const auditSchema = z.object({
  url: z.string().trim().min(1).max(2_048),
});

export const POST = withRoute(async (request) => {
  const input = auditSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) {
    return jsonResponse({ error: "Enter a valid website URL." }, 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.data.url);
  } catch {
    return jsonResponse({ error: "Enter a valid website URL." }, 400);
  }
  if (
    (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") ||
    parsedUrl.username !== "" ||
    parsedUrl.password !== ""
  ) {
    return jsonResponse({ error: "Use a public http(s) website URL without credentials." }, 400);
  }

  // runFreeAudit performs the authoritative DNS/IP SSRF check before any
  // outbound request. The parsed URL is safe to use only as a rate-limit key.
  await enforceAuditRateLimit(getPrisma(), request, parsedUrl.toString());
  return jsonResponse({ data: await runFreeAudit(parsedUrl.toString()) });
});

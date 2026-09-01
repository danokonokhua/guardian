import { getConfiguredReportingDestination } from "@/services/reporting/configured";
import { logger } from "@/lib/logger";

const destination = getConfiguredReportingDestination();
if (destination === undefined) {
  throw new Error("REPORTING_WEBHOOK_URL and REPORTING_WEBHOOK_SECRET must both be configured.");
}

await destination.deliver({
  organizationId: process.argv[2] ?? "smoke-test",
  format: "json",
  content: JSON.stringify({ source: "guardian-reporting-smoke", status: "ok" }),
  generatedAt: new Date().toISOString(),
});

logger.info("reporting_webhook_smoke_succeeded");

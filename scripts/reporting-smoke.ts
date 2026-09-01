import { getConfiguredReportingDestination } from "@/services/reporting/configured";

async function main(): Promise<void> {
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

  process.stdout.write("reporting_webhook_smoke_succeeded\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown reporting error";
  process.stderr.write(`reporting_webhook_smoke_failed: ${message}\n`);
  process.exitCode = 1;
});

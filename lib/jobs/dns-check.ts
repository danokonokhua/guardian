import type { Prisma } from "@prisma/client";
import {
  compareDns,
  DNS_RECORD_TYPES,
  type DnsSnapshot,
  type DnsRecordType,
} from "@/lib/dns/records";
import type { MonitorCheckOutcome } from "./monitor-outcome";
export function dnsOutcome(
  snapshot: DnsSnapshot,
  baseline: Partial<Record<DnsRecordType, string[]>>,
): MonitorCheckOutcome {
  const diff = compareDns(baseline, snapshot);
  const changed = diff.some((r) => r.state === "CHANGED");
  const unknown = diff.some((r) => r.state === "UNKNOWN");
  return {
    status: unknown ? "ERROR" : changed ? "DOWN" : "UP",
    healthy: !unknown && !changed,
    responseTimeMs: 0,
    details: {
      checkType: "DNS",
      snapshot: JSON.stringify(snapshot),
      changes: JSON.stringify(diff),
    },
    finding: {
      ruleId: "monitor.dns",
      severity: "MEDIUM",
      title: unknown
        ? "DNS observation incomplete"
        : changed
          ? "DNS records changed"
          : "DNS baseline matches",
      summary: unknown
        ? "Some DNS records could not be observed; the baseline is retained."
        : changed
          ? "DNS records differ from the accepted baseline. This does not necessarily indicate an outage."
          : "Observed records match the baseline or establish the initial baseline.",
      businessImpact: "DNS configuration changes can affect website routing and email delivery.",
      recommendedAction:
        "Review added and removed records. Accept the latest baseline only if the change is expected.",
    },
  };
}
export async function persistDnsObservation(
  tx: Prisma.TransactionClient,
  monitorId: string,
  snapshot: DnsSnapshot,
): Promise<MonitorCheckOutcome> {
  await tx.$queryRaw`SELECT id FROM monitoring_checks WHERE id = ${monitorId} FOR UPDATE`;
  const monitor = await tx.monitor.findUniqueOrThrow({ where: { id: monitorId } });
  const config = monitor.config as { baseline?: Partial<Record<DnsRecordType, string[]>> };
  const baseline = { ...config.baseline };
  const outcome = dnsOutcome(snapshot, baseline);
  for (const type of DNS_RECORD_TYPES) {
    const observed = snapshot[type];
    if (baseline[type] === undefined && observed.state === "OK") baseline[type] = observed.records;
  }
  await tx.monitor.update({
    where: { id: monitorId },
    data: {
      config: { ...config, baseline, latest: snapshot, observedAt: new Date().toISOString() },
    },
  });
  return outcome;
}

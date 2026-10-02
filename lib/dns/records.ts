/** Pure DNS baseline comparison. Persistence and scheduler integration follow separately. */
export const DNS_RECORD_TYPES = ["A", "AAAA", "MX", "NS", "TXT"] as const;
export type DnsRecordType = (typeof DNS_RECORD_TYPES)[number];
export type DnsObservation =
  { state: "OK"; records: string[] } | { state: "UNKNOWN"; reason: string };
export type DnsSnapshot = Record<DnsRecordType, DnsObservation>;
export function normalizeRecords(type: DnsRecordType, records: readonly string[]): string[] {
  if (records.length > 256 || records.some((r) => r.length > 4096))
    throw new Error("DNS response exceeds evidence limits");
  return [
    ...new Set(
      records.map((record) => {
        if (type === "TXT") return record;
        const value = record.trim().toLowerCase();
        if (type === "AAAA") return new URL(`http://[${value}]/`).hostname.slice(1, -1);
        if (type === "NS") return value.replace(/\.$/, "");
        if (type === "MX") {
          const match = /^(\d+)\s+(\S+)$/.exec(value);
          if (!match) throw new Error("Invalid MX evidence");
          const exchange = match[2] === "." ? "." : match[2]!.replace(/\.$/, "");
          return `${Number(match[1])} ${exchange}`;
        }
        return value;
      }),
    ),
  ].sort();
}
export function compareDns(
  baseline: Partial<Record<DnsRecordType, string[]>>,
  snapshot: DnsSnapshot,
) {
  return DNS_RECORD_TYPES.map((type) => {
    const current = snapshot[type];
    if (current.state === "UNKNOWN")
      return { type, state: "UNKNOWN" as const, reason: current.reason, added: [], removed: [] };
    const records = normalizeRecords(type, current.records);
    if (baseline[type] === undefined)
      return { type, state: "BASELINE_REQUIRED" as const, records, added: [], removed: [] };
    const previous = normalizeRecords(type, baseline[type]);
    const added = records.filter((r) => !previous.includes(r));
    const removed = previous.filter((r) => !records.includes(r));
    return {
      type,
      state: added.length || removed.length ? ("CHANGED" as const) : ("UNCHANGED" as const),
      records,
      added,
      removed,
    };
  });
}

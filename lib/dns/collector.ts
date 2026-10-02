import "server-only";
import { Resolver } from "node:dns/promises";
import { domainToASCII } from "node:url";
import { isIP } from "node:net";
import {
  DNS_RECORD_TYPES,
  normalizeRecords,
  type DnsSnapshot,
  type DnsRecordType,
} from "./records";
/** Call only with an authorized, verified domain. Does not connect to returned IPs. */
export async function collectDnsSnapshot(hostname: string): Promise<DnsSnapshot> {
  const host = domainToASCII(hostname).toLowerCase().replace(/\.$/, "");
  if (
    isIP(host) ||
    host.length > 253 ||
    !host.includes(".") ||
    host.split(".").some((label) => !/^([a-z0-9]|[a-z0-9][a-z0-9-]{0,61}[a-z0-9])$/.test(label))
  )
    throw Error("A valid DNS hostname is required");
  const resolver = new Resolver({ timeout: 3000, tries: 1 });
  const timer = setTimeout(() => resolver.cancel(), 5000);
  async function read(type: DnsRecordType) {
    try {
      let records: string[];
      switch (type) {
        case "A":
          records = await resolver.resolve4(host);
          break;
        case "AAAA":
          records = await resolver.resolve6(host);
          break;
        case "MX":
          // Node represents the DNS root (null MX) as an empty exchange.
          records = (await resolver.resolveMx(host)).map(
            (r) => `${r.priority} ${r.exchange || "."}`,
          );
          break;
        case "NS":
          records = await resolver.resolveNs(host);
          break;
        case "TXT":
          records = (await resolver.resolveTxt(host)).map((chunks) => chunks.join(""));
          break;
      }
      return { state: "OK" as const, records: normalizeRecords(type, records) };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // NODATA means a missing RRset; NXDOMAIN and transient failures retain baseline.
      if (code === "ENODATA") return { state: "OK" as const, records: [] };
      return { state: "UNKNOWN" as const, reason: code ?? "INVALID_RESPONSE" };
    }
  }
  try {
    const entries = await Promise.all(
      DNS_RECORD_TYPES.map(async (type) => [type, await read(type)] as const),
    );
    return Object.fromEntries(entries) as DnsSnapshot;
  } finally {
    clearTimeout(timer);
  }
}

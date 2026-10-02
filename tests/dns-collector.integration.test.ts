import { expect, it } from "vitest";
import { collectDnsSnapshot } from "@/lib/dns/collector";
import { DNS_RECORD_TYPES } from "@/lib/dns/records";

// Opt-in network smoke test; record values can legitimately change between reads.
it.skipIf(process.env.DNS_EXTERNAL_TEST !== "1")(
  "collects public DNS record sets twice",
  async () => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const snapshot = await collectDnsSnapshot("example.com");
      for (const type of DNS_RECORD_TYPES) expect(snapshot[type].state).toBe("OK");
      expect(snapshot.A.state === "OK" && snapshot.A.records.length).toBeGreaterThan(0);
      expect(snapshot.NS.state === "OK" && snapshot.NS.records.length).toBeGreaterThan(0);
    }
  },
  15000,
);

import { expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import { dnsOutcome, persistDnsObservation } from "@/lib/jobs/dns-check";
import type { DnsSnapshot } from "@/lib/dns/records";
const snapshot: DnsSnapshot = {
  A: { state: "OK", records: ["203.0.113.1"] },
  AAAA: { state: "OK", records: [] },
  MX: { state: "OK", records: [] },
  NS: { state: "OK", records: [] },
  TXT: { state: "OK", records: [] },
};
it("creates a DNS finding for a changed address without claiming an outage", () => {
  expect(dnsOutcome(snapshot, { A: ["203.0.113.2"] })).toMatchObject({
    healthy: false,
    status: "DOWN",
    finding: { ruleId: "monitor.dns", severity: "MEDIUM" },
  });
});
it("persists first observations and retains accepted values during changes and errors", async () => {
  const update = vi.fn();
  const tx = {
    $queryRaw: vi.fn(),
    monitor: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ config: { baseline: { A: ["203.0.113.2"], TXT: ["old"] } } }),
      update,
    },
  } as unknown as Prisma.TransactionClient;
  const result = await persistDnsObservation(tx, "monitor", {
    ...snapshot,
    TXT: { state: "UNKNOWN", reason: "ETIMEOUT" },
  });
  expect(result.status).toBe("ERROR");
  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: {
        config: expect.objectContaining({
          baseline: expect.objectContaining({ A: ["203.0.113.2"], TXT: ["old"], MX: [] }),
        }),
      },
    }),
  );
});
it("recovers when observations match the accepted baseline", () => {
  expect(
    dnsOutcome(snapshot, { A: ["203.0.113.1"], AAAA: [], MX: [], NS: [], TXT: [] }),
  ).toMatchObject({ healthy: true, status: "UP" });
});

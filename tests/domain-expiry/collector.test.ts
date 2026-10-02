import { beforeEach, expect, it, vi } from "vitest";
const outbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound: outbound }));
beforeEach(() => {
  vi.resetModules();
  outbound.mockReset();
});
const json = (value: unknown) => ({ ok: true, text: async () => JSON.stringify(value) });
it("uses IANA bootstrap and the registered domain, retaining the evidence source", async () => {
  outbound
    .mockResolvedValueOnce(json({ services: [[["com"], ["https://rdap.example.test/v1/"]]] }))
    .mockResolvedValueOnce(
      json({
        objectClassName: "domain",
        ldhName: "example.com",
        events: [{ eventAction: "expiration", eventDate: "2027-01-01T00:00:00Z" }],
      }),
    );
  const { collectDomainExpiry } = await import("@/lib/domain-expiry/collector");
  expect(await collectDomainExpiry("shop.example.com")).toMatchObject({
    state: "KNOWN",
    domain: "example.com",
    source: "https://rdap.example.test/v1/domain/example.com",
  });
  expect(outbound.mock.calls.map((call) => call[0])).toEqual([
    "https://data.iana.org/rdap/dns.json",
    "https://rdap.example.test/v1/domain/example.com",
  ]);
});
it("keeps registry failures unknown and does not fall back to an untrusted referral", async () => {
  outbound
    .mockResolvedValueOnce(json({ services: [[["com"], ["https://rdap.example.test/"]]] }))
    .mockResolvedValueOnce({ ok: false, status: 429 });
  const { collectDomainExpiry } = await import("@/lib/domain-expiry/collector");
  expect(await collectDomainExpiry("example.com")).toMatchObject({
    state: "UNKNOWN",
    reason: "rdap_http_429",
  });
  expect(outbound).toHaveBeenCalledTimes(2);
});
it("does not treat private suffixes or unsupported registries as healthy", async () => {
  outbound.mockResolvedValueOnce(json({ services: [] }));
  const { collectDomainExpiry } = await import("@/lib/domain-expiry/collector");
  expect(await collectDomainExpiry("tenant.github.io")).toMatchObject({
    state: "UNKNOWN",
    reason: "unsupported_registration_domain",
  });
  expect(outbound).not.toHaveBeenCalled();
  expect(await collectDomainExpiry("example.com")).toMatchObject({
    state: "UNKNOWN",
    reason: "rdap_not_supported",
  });
});

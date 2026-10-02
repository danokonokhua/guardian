import { describe, expect, it } from "vitest";
import {
  registrationDomain,
  parseExpiryResponse,
  expiryThreshold,
} from "@/lib/domain-expiry/records";
import { parseMonitorConfig } from "@/lib/monitor-config";

const source = "https://rdap.example.test/domain/example.com";
const response = (dates: string[]) => ({
  objectClassName: "domain",
  ldhName: "EXAMPLE.COM",
  events: dates.map((eventDate) => ({ eventAction: "expiration", eventDate })),
});
describe("registration expiry evidence", () => {
  it("resolves registered domains without confusing shared hosting or IPs", () => {
    expect(registrationDomain("www.shop.example.co.uk")).toBe("example.co.uk");
    expect(registrationDomain("www.bücher.de")).toBe("xn--bcher-kva.de");
    for (const host of ["127.0.0.1", "tenant.github.io", "localhost"])
      expect(registrationDomain(host)).toBeNull();
  });
  it("normalizes matching top-level expiry timestamps", () => {
    expect(
      parseExpiryResponse(
        response(["2027-01-01T01:00:00+01:00", "2027-01-01T00:00:00Z"]),
        "example.com",
        source,
      ),
    ).toMatchObject({ state: "KNOWN", expiresAt: "2027-01-01T00:00:00.000Z" });
  });
  it("preserves missing, malformed, redacted and contradictory dates as unknown", () => {
    for (const data of [
      response([]),
      response(["2027-02-31T00:00:00Z"]),
      response(["bad"]),
      response(["2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z"]),
      { ...response(["2027-01-01T00:00:00Z"]), redacted: [{}] },
      { ...response([]), entities: [{ events: response(["2027-01-01T00:00:00Z"]).events }] },
    ])
      expect(parseExpiryResponse(data, "example.com", source).state).toBe("UNKNOWN");
  });
  it("selects the most urgent crossed threshold, including exact boundaries", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    for (const [days, expected] of [
      [91, null],
      [90, 90],
      [31, 90],
      [30, 30],
      [7, 7],
      [1, 7],
      [0, 0],
      [-1, 0],
    ])
      expect(
        expiryThreshold(new Date(now.getTime() + days! * 86400000).toISOString(), [90, 30, 7], now),
      ).toBe(expected);
  });
  it("defaults to daily checks and rejects forged evidence or excessive frequency", () => {
    const input = { websiteId: "38ed7924-5682-41a9-9b33-b251c08892da", type: "DOMAIN_EXPIRY" };
    expect(parseMonitorConfig(input).frequencyMinutes).toBe(1440);
    expect(() => parseMonitorConfig({ ...input, frequencyMinutes: 5 })).toThrow();
    expect(() => parseMonitorConfig({ ...input, config: { expiry: {} } })).toThrow();
    expect(() => parseMonitorConfig({ ...input, config: { thresholds: [7, 7] } })).toThrow();
  });
});

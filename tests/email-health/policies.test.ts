import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkSpf } from "@/lib/email-health/spf";
import { checkDmarc, parseDmarc } from "@/lib/email-health/dmarc";
import { checkMtaSts, parseStsPolicy } from "@/lib/email-health/mta-sts";
import type { ReadDns } from "@/lib/email-health/types";
import { parseMonitorConfig } from "@/lib/monitor-config";
const outbound = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/outbound-url", () => ({ requestSafeOutbound: outbound }));
const read =
  (records: Record<string, string[]>): ReadDns =>
  async (name, type) => ({ state: "OK", records: records[`${type}:${name}`] ?? [] });
beforeEach(() => outbound.mockReset());
describe("SPF bounded analysis", () => {
  it.each([
    ["v=spf1 -all", "HEALTHY"],
    ["v=spf1 ip4:192.0.2.1 -all", "HEALTHY"],
    ["v=spf1 ip6:2001:db8::/32 -all", "HEALTHY"],
    ["v=spf1 ~all", "WEAK"],
    ["v=spf1 +all", "WEAK"],
    ["v=spf1 ip4:0.0.0.0/0 -all", "WEAK"],
    ["v=spf1 ip4:bad -all", "INVALID"],
    ["v=spf1 ip6:2001:db8::/129 -all", "INVALID"],
    ["v=spf1 invalid -all", "INVALID"],
    ["v=spf1 a -all", "UNKNOWN"],
    ["v=spf1 exists:%{i}.example.com -all", "UNKNOWN"],
  ])("classifies %s as %s", async (record, state) =>
    expect((await checkSpf("example.com", read({ "TXT:example.com": [record] }))).state).toBe(
      state,
    ),
  );
  it("detects missing policies, multiple policies and recursive loops", async () => {
    expect((await checkSpf("example.com", read({}))).state).toBe("MISSING");
    expect(
      (await checkSpf("example.com", read({ "TXT:example.com": ["v=spf1 -all", "v=spf1 ~all"] })))
        .state,
    ).toBe("INVALID");
    expect(
      (
        await checkSpf(
          "example.com",
          read({ "TXT:example.com": ["v=spf1 include:example.com -all"] }),
        )
      ).state,
    ).toBe("INVALID");
  });
  it("expands includes and redirects without treating child -all as rejection of the parent", async () => {
    const dns = read({
      "TXT:example.com": ["v=spf1 include:sender.test -all"],
      "TXT:sender.test": ["v=spf1 ip4:192.0.2.1 -all"],
    });
    expect((await checkSpf("example.com", dns)).state).toBe("HEALTHY");
    expect(
      (
        await checkSpf(
          "example.com",
          read({
            "TXT:example.com": ["v=spf1 redirect=sender.test"],
            "TXT:sender.test": ["v=spf1 -all"],
          }),
        )
      ).state,
    ).toBe("HEALTHY");
  });
  it("stops excessive expansion and preserves transient errors", async () => {
    let calls = 0;
    const endless: ReadDns = async () => ({
      state: "OK",
      records: [`v=spf1 include:d${++calls}.test -all`],
    });
    expect((await checkSpf("example.com", endless)).state).toBe("UNKNOWN");
    expect(calls).toBeLessThanOrEqual(11);
    expect(
      (await checkSpf("example.com", async () => ({ state: "UNKNOWN", reason: "ETIMEOUT" }))).state,
    ).toBe("UNKNOWN");
  });
});
describe("DMARC discovery", () => {
  it.each([
    ["v=DMARC1; p=reject", "HEALTHY"],
    ["v=DMARC1; p=none", "WEAK"],
    ["v=DMARC1; p=reject; t=y", "WEAK"],
    ["v=DMARC1; p=reject; pct=25", "WEAK"],
    ["v=DMARC1; p=reject; p=none", "INVALID"],
    ["v=DMARC1; p=bogus", "INVALID"],
    ["v=DMARC1; p=reject; aspf=bogus", "INVALID"],
    ["v=DMARC1; p=reject; rua=invalid", "INVALID"],
  ])("classifies %s", (record, state) =>
    expect(parseDmarc([record], "example.com").state).toBe(state),
  );
  it("uses organizational policy and sp for an existing subdomain", async () => {
    const result = await checkDmarc(
      "mail.example.com",
      read({ "TXT:_dmarc.example.com": ["v=DMARC1; p=reject; sp=none"] }),
    );
    expect(result).toMatchObject({
      state: "WEAK",
      policy: "none",
      source: "dns:_dmarc.example.com:TXT",
    });
  });
  it("honors explicit organizational boundaries and authoritative direct policy", async () => {
    const dns = read({
      "TXT:_dmarc.mail.example.com": ["v=DMARC1; p=reject; psd=n"],
      "TXT:_dmarc.example.com": ["v=DMARC1; p=none"],
    });
    expect((await checkDmarc("a.mail.example.com", dns)).state).toBe("HEALTHY");
    expect((await checkDmarc("mail.example.com", dns)).state).toBe("HEALTHY");
  });
  it("bounds tree walks and never treats a timeout as missing", async () => {
    const dns = vi.fn(read({}));
    expect((await checkDmarc("a.b.c.d.e.f.g.h.i.j.example.com", dns)).state).toBe("MISSING");
    expect(dns).toHaveBeenCalledTimes(8);
    expect(
      (await checkDmarc("example.com", async () => ({ state: "UNKNOWN", reason: "ETIMEOUT" })))
        .state,
    ).toBe("UNKNOWN");
  });
});
describe("MTA-STS", () => {
  const policy = "version: STSv1\nmode: enforce\nmx: mail.example.com\nmax_age: 604800\n";
  it("validates required fields, duplicate fields, testing mode and patterns", () => {
    expect(parseStsPolicy(policy, "https://example.test").state).toBe("HEALTHY");
    for (const value of [
      policy + "mode: none\n",
      policy.replace("604800", "-1"),
      policy.replace("mail.example.com", "https://evil.test"),
    ])
      expect(parseStsPolicy(value, "x").state).toBe("INVALID");
    expect(parseStsPolicy(policy.replace("enforce", "testing"), "x").state).toBe("WEAK");
  });
  it("fetches only the fixed HTTPS policy URL and checks MX coverage", async () => {
    outbound.mockResolvedValue({ ok: true, status: 200, text: async () => policy });
    const dns = read({
      "TXT:_mta-sts.example.com": ["v=STSv1; id=abc123"],
      "MX:example.com": ["mail.example.com"],
    });
    expect((await checkMtaSts("example.com", dns)).state).toBe("HEALTHY");
    expect(outbound.mock.calls[0]![0]).toBe("https://mta-sts.example.com/.well-known/mta-sts.txt");
    expect(
      (
        await checkMtaSts(
          "example.com",
          read({
            "TXT:_mta-sts.example.com": ["v=STSv1; id=abc123"],
            "MX:example.com": ["other.example.com"],
          }),
        )
      ).state,
    ).toBe("INVALID");
  });
  it("distinguishes missing, invalid and failed retrieval without following redirects", async () => {
    expect((await checkMtaSts("example.com", read({}))).state).toBe("MISSING");
    expect(
      (
        await checkMtaSts(
          "example.com",
          read({ "TXT:_mta-sts.example.com": ["v=STSv1; id=bad!id"] }),
        )
      ).state,
    ).toBe("INVALID");
    for (const response of [
      { ok: false, status: 302 },
      { ok: true, status: 200, bodyTruncated: true },
    ]) {
      outbound.mockResolvedValue(response);
      expect(
        (await checkMtaSts("example.com", read({ "TXT:_mta-sts.example.com": ["v=STSv1; id=a"] })))
          .state,
      ).toBe("UNKNOWN");
    }
  });
});
it("validates email monitor scope/frequency and rejects forged evidence", () => {
  const input = { websiteId: "38ed7924-5682-41a9-9b33-b251c08892da", type: "EMAIL_HEALTH" };
  expect(parseMonitorConfig(input).frequencyMinutes).toBe(1440);
  expect(() => parseMonitorConfig({ ...input, frequencyMinutes: 1 })).toThrow();
  expect(() => parseMonitorConfig({ ...input, config: { emailHealth: {} } })).toThrow();
  expect(() => parseMonitorConfig({ ...input, config: { domainScope: "evil.test" } })).toThrow();
});

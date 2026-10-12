import { describe, expect, it } from "vitest";
import { calculateDeliverabilityScore } from "@/lib/email-health/types";
import { checkDkim } from "@/lib/email-health/dkim";

describe("Email Deliverability & DKIM Scoring", () => {
  it("calculates 100/100 for perfectly configured SPF, DMARC, DKIM, MTA-STS", () => {
    const checks = {
      SPF: { state: "HEALTHY" as const, summary: "", source: "", records: [] },
      DMARC: { state: "HEALTHY" as const, summary: "", source: "", records: [] },
      DKIM: { state: "HEALTHY" as const, summary: "", source: "", records: [] },
      MTA_STS: { state: "HEALTHY" as const, summary: "", source: "", records: [] },
    };

    const result = calculateDeliverabilityScore(checks);
    expect(result.score).toBe(100);
    expect(result.status).toBe("EXCELLENT");
  });

  it("penalizes missing DMARC and DKIM", () => {
    const checks = {
      SPF: { state: "HEALTHY" as const, summary: "", source: "", records: [] },
      DMARC: { state: "MISSING" as const, summary: "", source: "", records: [] },
      DKIM: { state: "MISSING" as const, summary: "", source: "", records: [] },
      MTA_STS: { state: "MISSING" as const, summary: "", source: "", records: [] },
    };

    const result = calculateDeliverabilityScore(checks);
    expect(result.score).toBe(30);
    expect(result.status).toBe("CRITICAL");
  });

  it("verifies DKIM record with public key", async () => {
    const mockReadDns = async (host: string) => {
      if (host === "google._domainkey.example.com") {
        return {
          state: "OK" as const,
          records: [
            "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0exampleKeyLongEnough20Chars",
          ],
        };
      }
      return { state: "OK" as const, records: [] };
    };

    const evidence = await checkDkim("example.com", mockReadDns);
    expect(evidence.state).toBe("HEALTHY");
    expect(evidence.summary).toContain('selector "google"');
  });
});


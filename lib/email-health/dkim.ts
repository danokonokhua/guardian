import { evidence, type PolicyEvidence, type ReadDns } from "./types";

const COMMON_SELECTORS = ["google", "k1", "default", "s1", "resend", "selector1", "mail", "api"];

export async function checkDkim(
  domain: string,
  read: ReadDns,
  customSelectors: string[] = [],
): Promise<PolicyEvidence> {
  const selectorsToTest = [
    ...new Set([...customSelectors.map((s) => s.trim().toLowerCase()), ...COMMON_SELECTORS]),
  ].filter(Boolean);

  let unknownReason: string | undefined;

  for (const selector of selectorsToTest) {
    const dkimHost = `${selector}._domainkey.${domain}`;
    const result = await read(dkimHost, "TXT");

    if (result.state === "UNKNOWN") {
      unknownReason = result.reason;
      continue;
    }

    const dkimRecords = result.records.filter(
      (r) => /v\s*=\s*DKIM1/i.test(r) || /p\s*=\s*[A-Za-z0-9+/=]+/i.test(r),
    );

    if (dkimRecords.length > 0) {
      const record = dkimRecords[0];
      if (!record) continue;
      const hasPublicKey = /p\s*=\s*[A-Za-z0-9+/=]{20,}/i.test(record);

      if (hasPublicKey) {
        return {
          state: "HEALTHY",
          summary: `DKIM signature key published on selector "${selector}".`,
          source: dkimHost,
          records: dkimRecords,
          policy: `v=DKIM1; selector=${selector}`,
        };
      }

      // If p= is empty, it means revoked key
      if (/p\s*=\s*;/i.test(record) || /p\s*=\s*$/i.test(record)) {
        return {
          state: "WEAK",
          summary: `DKIM selector "${selector}" publishes an empty/revoked public key.`,
          source: dkimHost,
          records: dkimRecords,
        };
      }

      return {
        state: "INVALID",
        summary: `DKIM selector "${selector}" record is malformed.`,
        source: dkimHost,
        records: dkimRecords,
      };
    }
  }

  if (unknownReason) {
    return evidence("UNKNOWN", `DKIM check unavailable (${unknownReason})`, `_domainkey.${domain}`);
  }

  return {
    state: "MISSING",
    summary:
      "No standard DKIM selectors (google, k1, default, s1, resend) discovered for this domain.",
    source: `_domainkey.${domain}`,
    records: [],
    details: [
      "DKIM requires a known selector name. If using a custom email provider, add your selector in monitor configuration.",
    ],
  };
}


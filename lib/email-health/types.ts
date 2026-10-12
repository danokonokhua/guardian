export const EMAIL_PROTOCOLS = ["SPF", "DMARC", "DKIM", "MTA_STS"] as const;
export type EmailProtocol = (typeof EMAIL_PROTOCOLS)[number];
export type PolicyState = "HEALTHY" | "MISSING" | "INVALID" | "WEAK" | "UNKNOWN";
export type PolicyEvidence = {
  state: PolicyState;
  summary: string;
  source: string;
  records: string[];
  policy?: string;
  details?: string[];
};
export type EmailHealthSnapshot = {
  domain: string;
  checkedAt: string;
  checks: Record<EmailProtocol, PolicyEvidence>;
};
export type EmailHealthConfig = {
  domainScope?: "REGISTERED" | "HOSTNAME";
  dkimSelectors?: string[];
  emailHealth?: EmailHealthSnapshot;
  emailLastKnown?: Partial<Record<EmailProtocol, PolicyEvidence & { checkedAt: string }>>;
  emailChanges?: string[];
};
export type DnsAnswer = { state: "OK"; records: string[] } | { state: "UNKNOWN"; reason: string };
export type ReadDns = (hostname: string, type: "TXT" | "MX" | "A" | "AAAA") => Promise<DnsAnswer>;
export const evidence = (
  state: PolicyState,
  summary: string,
  source: string,
  records: string[] = [],
): PolicyEvidence => ({ state, summary, source, records });

export function calculateDeliverabilityScore(
  checks?: Partial<Record<EmailProtocol, PolicyEvidence>>,
): {
  score: number;
  label: string;
  status: "EXCELLENT" | "GOOD" | "WARNING" | "CRITICAL";
} {
  if (!checks) return { score: 0, label: "Unchecked", status: "CRITICAL" };

  let score = 0;

  // DMARC (up to 40 pts)
  if (checks.DMARC?.state === "HEALTHY") score += 40;
  else if (checks.DMARC?.state === "WEAK") score += 20;

  // SPF (up to 30 pts)
  if (checks.SPF?.state === "HEALTHY") score += 30;
  else if (checks.SPF?.state === "WEAK") score += 15;

  // DKIM (up to 20 pts)
  if (checks.DKIM?.state === "HEALTHY") score += 20;
  else if (checks.DKIM?.state === "WEAK") score += 10;

  // MTA-STS (up to 10 pts)
  if (checks.MTA_STS?.state === "HEALTHY") score += 10;

  if (score >= 85) return { score, label: "Excellent Protection", status: "EXCELLENT" };
  if (score >= 60) return { score, label: "Good Deliverability", status: "GOOD" };
  if (score >= 35) return { score, label: "Vulnerable to Spoofing", status: "WARNING" };
  return { score, label: "High Spoofing Risk", status: "CRITICAL" };
}

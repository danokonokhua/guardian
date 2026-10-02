export const EMAIL_PROTOCOLS = ["SPF", "DMARC", "MTA_STS"] as const;
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

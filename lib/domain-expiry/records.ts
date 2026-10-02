import { domainToASCII } from "node:url";
import { parse } from "tldts";
import { z } from "zod";

export type ExpiryObservation =
  | { state: "KNOWN"; domain: string; expiresAt: string; source: string }
  | { state: "UNKNOWN"; domain: string; reason: string; source?: string };

export function registrationDomain(hostname: string): string | null {
  const host = domainToASCII(hostname).toLowerCase().replace(/\.$/, "");
  const result = parse(host, { allowPrivateDomains: true });
  // Shared hosting/private suffixes do not establish ownership of the registry domain.
  return result.isIcann && !result.isPrivate && !result.isIp ? result.domain : null;
}

export function parseExpiryResponse(
  value: unknown,
  domain: string,
  source: string,
): ExpiryObservation {
  const unknown = (reason: string): ExpiryObservation => ({
    state: "UNKNOWN",
    domain,
    source,
    reason,
  });
  if (!value || typeof value !== "object") return unknown("invalid_response");
  const data = value as Record<string, unknown>;
  if (
    data.objectClassName !== "domain" ||
    typeof data.ldhName !== "string" ||
    domainToASCII(data.ldhName).toLowerCase().replace(/\.$/, "") !== domain
  )
    return unknown("domain_mismatch");
  // Conservatively refuse redacted responses rather than infer a healthy deadline.
  if (Array.isArray(data.redacted) && data.redacted.length) return unknown("redacted_response");
  if (!Array.isArray(data.events)) return unknown("expiry_unavailable");
  const events = data.events.filter((event) => event?.eventAction === "expiration");
  if (!events.length) return unknown("expiry_unavailable");
  const dates: string[] = [];
  for (const event of events) {
    if (
      typeof event.eventDate !== "string" ||
      !z.iso.datetime({ offset: true }).safeParse(event.eventDate).success
    )
      return unknown("invalid_expiry");
    const time = Date.parse(event.eventDate);
    if (!Number.isFinite(time)) return unknown("invalid_expiry");
    dates.push(new Date(time).toISOString());
  }
  if (new Set(dates).size !== 1) return unknown("conflicting_expiry");
  return { state: "KNOWN", domain, expiresAt: dates[0]!, source };
}

export function expiryThreshold(
  expiresAt: string,
  thresholds: number[],
  now = new Date(),
): number | null {
  const remaining = Date.parse(expiresAt) - now.getTime();
  if (remaining <= 0) return 0;
  return [...thresholds].sort((a, b) => a - b).find((days) => remaining <= days * 86400000) ?? null;
}

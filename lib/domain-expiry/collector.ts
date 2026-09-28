import "server-only";
import { requestSafeOutbound } from "@/lib/security/outbound-url";
import { parseExpiryResponse, registrationDomain, type ExpiryObservation } from "./records";

let bootstrap: { until: number; services: unknown[] } | undefined;
async function readJson(url: string) {
  const response = await requestSafeOutbound(url, { timeoutMs: 8000, maxBodyBytes: 256 * 1024 });
  if (!response.ok) throw new Error(`rdap_http_${response.status}`);
  return JSON.parse(await response.text()) as Record<string, unknown>;
}

/** Verified website input only; RDAP links/referrals and redirects are not followed. */
export async function collectDomainExpiry(hostname: string): Promise<ExpiryObservation> {
  const domain = registrationDomain(hostname);
  if (!domain)
    return { state: "UNKNOWN", domain: hostname, reason: "unsupported_registration_domain" };
  let source: string | undefined;
  try {
    if (!bootstrap || bootstrap.until < Date.now()) {
      const data = await readJson("https://data.iana.org/rdap/dns.json");
      if (!Array.isArray(data.services)) throw Error("invalid_bootstrap");
      bootstrap = { until: Date.now() + 86400000, services: data.services };
    }
    const tld = domain.split(".").at(-1)!;
    for (const service of bootstrap.services) {
      if (
        !Array.isArray(service) ||
        !Array.isArray(service[0]) ||
        !service[0].includes(tld) ||
        !Array.isArray(service[1])
      )
        continue;
      const endpoint = service[1].find(
        (value: unknown) => typeof value === "string" && value.startsWith("https://"),
      );
      if (endpoint) {
        const base = new URL(endpoint);
        if (base.username || base.password || base.search || base.hash) continue;
        source = new URL(
          `domain/${encodeURIComponent(domain)}`,
          base.href.endsWith("/") ? base.href : base.href + "/",
        ).href;
        break;
      }
    }
    if (!source) return { state: "UNKNOWN", domain, reason: "rdap_not_supported" };
    return parseExpiryResponse(await readJson(source), domain, source);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      state: "UNKNOWN",
      domain,
      ...(source ? { source } : {}),
      reason: /^rdap_http_\d+$/.test(message) ? message : "rdap_unavailable",
    };
  }
}

import "server-only";
import { Resolver } from "node:dns/promises";
import { domainToASCII } from "node:url";
import { registrationDomain } from "@/lib/domain-expiry/records";
import { checkSpf } from "./spf";
import { checkDmarc } from "./dmarc";
import { checkMtaSts } from "./mta-sts";
import { type ReadDns, type EmailHealthSnapshot } from "./types";

export async function collectEmailHealth(
  hostname: string,
  scope: "REGISTERED" | "HOSTNAME" = "REGISTERED",
): Promise<EmailHealthSnapshot> {
  const host = domainToASCII(hostname).toLowerCase().replace(/\.$/, "");
  const domain = scope === "REGISTERED" ? (registrationDomain(host) ?? host) : host;
  const resolver = new Resolver({ timeout: 2500, tries: 1 });
  const deadline = Date.now() + 15000;
  const timer = setTimeout(() => resolver.cancel(), 15000);
  const cache = new Map<string, ReturnType<ReadDns>>();
  let queries = 0;
  const read: ReadDns = (name, type) => {
    const key = `${type}:${name}`;
    const cached = cache.get(key);
    if (cached) return cached;
    const pending: ReturnType<ReadDns> = (async () => {
      if (Date.now() >= deadline || ++queries > 40)
        return { state: "UNKNOWN", reason: "analysis_limit" };
      try {
        const records =
          type === "TXT"
            ? (await resolver.resolveTxt(name)).map((chunks) => chunks.join(""))
            : type === "MX"
              ? (await resolver.resolveMx(name)).map((mx) =>
                  (mx.exchange || ".").toLowerCase().replace(/(?<!^)\.$/, ""),
                )
              : type === "A"
                ? await resolver.resolve4(name)
                : await resolver.resolve6(name);
        if (records.length > 100 || records.some((r) => r.length > 4096))
          return { state: "UNKNOWN", reason: "response_limit" };
        return { state: "OK", records: [...new Set(records)].sort() };
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return code === "ENODATA" || code === "ENOTFOUND"
          ? { state: "OK", records: [] }
          : { state: "UNKNOWN", reason: code ?? "dns_failure" };
      }
    })();
    cache.set(key, pending);
    return pending;
  };
  try {
    const [SPF, DMARC, MTA_STS] = await Promise.all([
      checkSpf(domain, read),
      checkDmarc(domain, read),
      checkMtaSts(domain, read),
    ]);
    return { domain, checkedAt: new Date().toISOString(), checks: { SPF, DMARC, MTA_STS } };
  } finally {
    clearTimeout(timer);
  }
}

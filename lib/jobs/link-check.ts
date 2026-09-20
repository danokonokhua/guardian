import { requestSafeOutbound } from "@/lib/security/outbound-url";

const DEFAULT_MAX_LINKS = 50;
const MAX_LINKS = 50;
const PAGE_TIMEOUT_MS = 10_000;
const PAGE_MAX_BODY_BYTES = 256 * 1024;
const LINK_TIMEOUT_MS = 10_000;
const LINK_MAX_BODY_BYTES = 8 * 1024;

export type LinkCheckOutcome = {
  status: "UP" | "DOWN" | "ERROR";
  healthy: boolean;
  responseTimeMs: number;
  httpStatusCode?: number;
  errorMessage?: string;
  details: Record<string, string | number>;
  finding: {
    ruleId: string;
    severity: "HIGH";
    title: string;
    summary: string;
  };
};

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function maxLinksFromConfig(config: unknown): number {
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    return DEFAULT_MAX_LINKS;
  }
  const candidate = (config as Record<string, unknown>).maxLinks;
  return typeof candidate === "number" && Number.isInteger(candidate) && candidate > 0
    ? Math.min(candidate, MAX_LINKS)
    : DEFAULT_MAX_LINKS;
}

/** Extracts unique, same-origin HTTP(S) links from one bounded HTML document. */
export function extractSameOriginLinks(
  html: string,
  sourceUrl: string,
  maxLinks = MAX_LINKS,
): string[] {
  let source: URL;
  try {
    source = new URL(sourceUrl);
  } catch {
    return [];
  }
  const links: string[] = [];
  const seen = new Set<string>();
  const hrefPattern = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`]+))/gi;
  for (const match of html.matchAll(hrefPattern)) {
    const rawHref = decodeHtml((match[1] ?? match[2] ?? match[3] ?? "").trim());
    if (rawHref === "" || rawHref.startsWith("#")) continue;
    let target: URL;
    try {
      target = new URL(rawHref, source);
    } catch {
      continue;
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") continue;
    if (target.username !== "" || target.password !== "" || target.origin !== source.origin)
      continue;
    target.hash = "";
    const normalized = target.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    links.push(normalized);
    if (links.length >= maxLinks) break;
  }
  return links;
}

type LinkFailure = { url: string; status: number; reason: string };

/** Runs a bounded same-origin link check and returns evidence suitable for an issue. */
export async function runLinksCheck(url: string, config: unknown = {}): Promise<LinkCheckOutcome> {
  const startedAt = Date.now();
  let page;
  try {
    page = await requestSafeOutbound(url, {
      method: "GET",
      timeoutMs: PAGE_TIMEOUT_MS,
      maxBodyBytes: PAGE_MAX_BODY_BYTES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Page request failed.";
    return {
      status: "ERROR",
      healthy: false,
      responseTimeMs: Date.now() - startedAt,
      errorMessage: message,
      details: { checkType: "LINKS", scannedLinks: 0, brokenLinks: 0 },
      finding: {
        ruleId: "monitor.links",
        severity: "HIGH",
        title: "Website links could not be checked",
        summary: "Guardian could not load the verified homepage to inspect its links.",
      },
    };
  }
  if (page.status < 200 || page.status >= 400) {
    return {
      status: page.status >= 300 && page.status < 400 ? "ERROR" : "DOWN",
      healthy: false,
      responseTimeMs: Date.now() - startedAt,
      httpStatusCode: page.status,
      errorMessage: `Homepage returned HTTP ${page.status}.`,
      details: { checkType: "LINKS", scannedLinks: 0, brokenLinks: 0 },
      finding: {
        ruleId: "monitor.links",
        severity: "HIGH",
        title: "Website links could not be checked",
        summary: `Guardian could not load the homepage (HTTP ${page.status}).`,
      },
    };
  }

  const links = extractSameOriginLinks(await page.text(), url, maxLinksFromConfig(config));
  const broken: LinkFailure[] = [];
  for (const link of links) {
    try {
      let response = await requestSafeOutbound(link, {
        method: "HEAD",
        timeoutMs: LINK_TIMEOUT_MS,
        maxBodyBytes: 0,
      });
      if (response.status === 405 || response.status === 501) {
        response = await requestSafeOutbound(link, {
          method: "GET",
          timeoutMs: LINK_TIMEOUT_MS,
          maxBodyBytes: LINK_MAX_BODY_BYTES,
        });
      }
      if (response.status >= 400 || response.status === 0) {
        broken.push({ url: link, status: response.status, reason: `HTTP ${response.status}` });
      }
    } catch (error: unknown) {
      broken.push({
        url: link,
        status: 0,
        reason: error instanceof Error ? error.message.slice(0, 200) : "Request failed",
      });
    }
  }

  const brokenSample = broken
    .slice(0, 20)
    .map((failure) => `${failure.status || "ERR"} ${failure.url} (${failure.reason})`)
    .join(" | ");
  const details = {
    checkType: "LINKS",
    scannedLinks: links.length,
    brokenLinks: broken.length,
    ...(brokenSample === "" ? {} : { brokenSample }),
  };
  return {
    status: broken.length === 0 ? "UP" : "DOWN",
    healthy: broken.length === 0,
    responseTimeMs: Date.now() - startedAt,
    httpStatusCode: page.status,
    details,
    finding: {
      ruleId: "monitor.links",
      severity: "HIGH",
      title: "Broken links detected",
      summary:
        broken.length === 0
          ? "All sampled same-origin links responded successfully."
          : `${broken.length} of ${links.length} sampled same-origin links failed.`,
    },
  };
}

import "server-only";

import type { MonitorCheckOutcome } from "@/lib/jobs/monitor-outcome";
import { requestSafeOutbound } from "@/lib/security/outbound-url";

const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_MAX_BODY_BYTES = 512 * 1024;
const AUXILIARY_MAX_BODY_BYTES = 128 * 1024;

type SeoFailure = { check: string; message: string };

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function plainText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function attributeValue(tag: string, attribute: string): string | null {
  const expression = new RegExp(
    `(?:^|\\s)${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'<>]+))`,
    "i",
  );
  const match = expression.exec(tag);
  return decodeHtml((match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim()) || null;
}

function metaContent(html: string, name: string): string | null {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attributeValue(tag, "name")?.toLowerCase() === name) {
      return attributeValue(tag, "content");
    }
  }
  return null;
}

function canonicalHref(html: string): string | null {
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    const relationships = attributeValue(tag, "rel")?.toLowerCase().split(/\s+/) ?? [];
    if (relationships.includes("canonical")) return attributeValue(tag, "href");
  }
  return null;
}

function titleText(html: string): string {
  return plainText(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
}

function h1Count(html: string): number {
  return (html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? []).filter(
    (heading) => plainText(heading) !== "",
  ).length;
}

function containsNoIndexDirective(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && /(?:^|[\s,;])noindex(?:$|[\s,;])/i.test(value);
}

function hasNoIndexDirective(html: string, xRobotsTag: string | undefined): boolean {
  return (
    containsNoIndexDirective(metaContent(html, "robots")) ||
    containsNoIndexDirective(metaContent(html, "googlebot")) ||
    containsNoIndexDirective(xRobotsTag)
  );
}

function responseHeader(
  headers: Readonly<Record<string, string>> | undefined,
  name: string,
): string | undefined {
  const expected = name.toLowerCase();
  return Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === expected)?.[1];
}

function robotsDisallowsPath(robots: string, path: string): boolean {
  let appliesToAll = false;
  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const userAgent = /^user-agent\s*:\s*(.+)$/i.exec(line)?.[1]?.trim();
    if (userAgent !== undefined) {
      appliesToAll = userAgent === "*";
      continue;
    }
    if (!appliesToAll) continue;
    const disallow = /^disallow\s*:\s*(.*)$/i.exec(line)?.[1]?.trim();
    if (disallow && path.startsWith(disallow)) return true;
  }
  return false;
}

function sameOriginSitemap(robots: string, pageUrl: URL): URL {
  for (const rawLine of robots.split(/\r?\n/)) {
    const value = /^sitemap\s*:\s*(\S+)/i.exec(rawLine.trim())?.[1];
    if (!value) continue;
    try {
      const candidate = new URL(value, pageUrl);
      if (
        candidate.origin === pageUrl.origin &&
        candidate.username === "" &&
        candidate.password === "" &&
        (candidate.protocol === "http:" || candidate.protocol === "https:")
      ) {
        return candidate;
      }
    } catch {
      // Ignore malformed directives and use the bounded default below.
    }
  }
  return new URL("/sitemap.xml", pageUrl.origin);
}

function validCanonical(value: string | null, pageUrl: URL): boolean {
  if (!value) return false;
  try {
    const canonical = new URL(value, pageUrl);
    return (
      (canonical.protocol === "http:" || canonical.protocol === "https:") &&
      canonical.username === "" &&
      canonical.password === ""
    );
  } catch {
    return false;
  }
}

function pageFailure(
  startedAt: number,
  status: "DOWN" | "ERROR",
  message: string,
  httpStatusCode?: number,
): MonitorCheckOutcome {
  return {
    status,
    healthy: false,
    responseTimeMs: Math.max(0, Date.now() - startedAt),
    ...(httpStatusCode === undefined ? {} : { httpStatusCode }),
    ...(status === "ERROR" ? { errorMessage: message } : {}),
    details: {
      checkType: "SEO",
      failureCount: 1,
      failedChecks: "page",
      ...(httpStatusCode === undefined ? {} : { httpStatusCode }),
    },
    finding: {
      ruleId: "monitor.seo",
      severity: "MEDIUM",
      title: "SEO page could not be checked",
      summary: message,
    },
  };
}

/** Runs the bounded basic-SEO contract against one verified page. */
export async function runSeoCheck(url: string): Promise<MonitorCheckOutcome> {
  const startedAt = Date.now();
  let pageUrl: URL;
  try {
    pageUrl = new URL(url);
  } catch {
    return pageFailure(startedAt, "ERROR", "The configured website URL is invalid.");
  }

  let page;
  try {
    page = await requestSafeOutbound(pageUrl.toString(), {
      method: "GET",
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBodyBytes: PAGE_MAX_BODY_BYTES,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Page request failed.";
    return pageFailure(startedAt, "ERROR", message);
  }

  if (page.status < 200 || page.status >= 300) {
    const isRedirect = page.status >= 300 && page.status < 400;
    return pageFailure(
      startedAt,
      isRedirect || page.status === 0 ? "ERROR" : "DOWN",
      isRedirect
        ? `Homepage returned redirect HTTP ${page.status}; the SEO scanner does not follow redirects.`
        : `Homepage returned HTTP ${page.status}.`,
      page.status,
    );
  }

  let html: string;
  try {
    html = await page.text();
  } catch {
    return pageFailure(startedAt, "ERROR", "The homepage response could not be read.", page.status);
  }

  const failures: SeoFailure[] = [];
  const title = titleText(html);
  const description = metaContent(html, "description")?.trim() ?? "";
  const headings = h1Count(html);
  const canonical = canonicalHref(html);
  const canonicalIsValid = validCanonical(canonical, pageUrl);
  const xRobotsTag = responseHeader(page.headers, "x-robots-tag");
  const metaNoIndex = hasNoIndexDirective(html, xRobotsTag);

  if (title === "") failures.push({ check: "title", message: "The page has no title." });
  if (description === "") {
    failures.push({ check: "meta_description", message: "The page has no meta description." });
  }
  if (headings === 0) failures.push({ check: "h1", message: "The page has no non-empty H1." });
  if (!canonicalIsValid) {
    failures.push({ check: "canonical", message: "The page has no valid canonical URL." });
  }
  if (metaNoIndex) {
    failures.push({
      check: "indexability",
      message: "The page response contains a noindex directive.",
    });
  }

  const robotsUrl = new URL("/robots.txt", pageUrl.origin).toString();
  let robotsBody = "";
  let robotsStatus = 0;
  try {
    const robots = await requestSafeOutbound(robotsUrl, {
      method: "GET",
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBodyBytes: AUXILIARY_MAX_BODY_BYTES,
    });
    robotsStatus = robots.status;
    if (robots.status >= 200 && robots.status < 300) {
      robotsBody = await robots.text();
    } else if (robots.status !== 404 && robots.status !== 410) {
      // A missing robots file means the default crawl policy applies. Other
      // responses are not reliable enough to evaluate indexability.
      failures.push({ check: "robots", message: `robots.txt returned HTTP ${robots.status}.` });
    }
  } catch {
    failures.push({ check: "robots", message: "robots.txt could not be loaded." });
  }

  const robotsBlocksPage =
    robotsBody !== "" && robotsDisallowsPath(robotsBody, pageUrl.pathname || "/");
  if (robotsBlocksPage && !failures.some(({ check }) => check === "indexability")) {
    failures.push({ check: "indexability", message: "robots.txt blocks the monitored page." });
  }

  const sitemapUrl = sameOriginSitemap(robotsBody, pageUrl);
  let sitemapStatus = 0;
  try {
    const sitemap = await requestSafeOutbound(sitemapUrl.toString(), {
      method: "GET",
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBodyBytes: AUXILIARY_MAX_BODY_BYTES,
    });
    sitemapStatus = sitemap.status;
    if (sitemap.status < 200 || sitemap.status >= 300) {
      failures.push({ check: "sitemap", message: `Sitemap returned HTTP ${sitemap.status}.` });
    } else if (!/<(?:[a-z][\w.-]*:)?(?:urlset|sitemapindex)\b/i.test(await sitemap.text())) {
      failures.push({ check: "sitemap", message: "The sitemap response is not a URL sitemap." });
    }
  } catch {
    failures.push({ check: "sitemap", message: "The sitemap could not be loaded." });
  }

  const failedChecks = [...new Set(failures.map(({ check }) => check))];
  const healthy = failures.length === 0;
  return {
    status: healthy ? "UP" : "DOWN",
    healthy,
    responseTimeMs: Math.max(0, Date.now() - startedAt),
    httpStatusCode: page.status,
    details: {
      checkType: "SEO",
      failureCount: failures.length,
      failedChecks: failedChecks.join(",") || "none",
      titleLength: title.length,
      metaDescriptionLength: description.length,
      h1Count: headings,
      canonical: canonical?.slice(0, 500) ?? "missing",
      indexable: metaNoIndex || robotsBlocksPage ? 0 : 1,
      xRobotsTag: xRobotsTag?.slice(0, 500) ?? "none",
      robotsStatus,
      sitemapStatus,
      sitemapUrl: sitemapUrl.toString().slice(0, 500),
    },
    finding: {
      ruleId: "monitor.seo",
      severity: "MEDIUM",
      title: "Basic SEO checks failed",
      summary: healthy
        ? "The monitored page passed the basic SEO checks."
        : failures
            .map(({ message }) => message)
            .join(" ")
            .slice(0, 1_000),
    },
  };
}

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

// ---------------------------------------------------------------------------
// Phase 16: Advanced SEO Intelligence
// ---------------------------------------------------------------------------

export interface AdvancedSeoIssue {
  ruleId: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  summary: string;
  recommendation: string;
}

export interface AdvancedSeoData {
  url: string;
  scannedAt: string;
  healthy: boolean;
  score: number;
  title: string;
  titleLength: number;
  titleStatus: "optimal" | "too_short" | "too_long" | "missing";
  description: string;
  descriptionLength: number;
  descriptionStatus: "optimal" | "too_short" | "too_long" | "missing";
  canonical: string | null;
  canonicalOriginMatch: boolean;
  openGraph: {
    title: string | null;
    description: string | null;
    image: string | null;
    type: string | null;
    url: string | null;
    present: boolean;
  };
  twitterCard: {
    card: string | null;
    title: string | null;
    description: string | null;
    image: string | null;
    present: boolean;
  };
  structuredData: {
    found: boolean;
    validCount: number;
    invalidCount: number;
    types: string[];
  };
  headings: {
    h1Count: number;
    h1Text: string[];
    h2Count: number;
    h3Count: number;
    hasMultipleH1: boolean;
    hasMissingH1: boolean;
  };
  images: {
    total: number;
    withAlt: number;
    missingAlt: number;
  };
  links: {
    internalCount: number;
    externalCount: number;
    totalCount: number;
  };
  issues: AdvancedSeoIssue[];
}

export function metaTagValue(html: string, nameOrProp: string): string | null {
  const target = nameOrProp.toLowerCase();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attributeValue(tag, "name")?.toLowerCase();
    const prop = attributeValue(tag, "property")?.toLowerCase();
    if (name === target || prop === target) {
      return attributeValue(tag, "content");
    }
  }
  return null;
}

export function extractStructuredData(html: string): {
  found: boolean;
  validCount: number;
  invalidCount: number;
  types: string[];
} {
  const scriptRegex =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let validCount = 0;
  let invalidCount = 0;
  const typesSet = new Set<string>();

  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      validCount++;
      const collectTypes = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (typeof obj["@type"] === "string") typesSet.add(obj["@type"]);
        if (Array.isArray(obj["@type"])) {
          obj["@type"].forEach((t: unknown) => typeof t === "string" && typesSet.add(t));
        }
        if (Array.isArray(obj["@graph"])) {
          obj["@graph"].forEach(collectTypes);
        }
      };
      if (Array.isArray(parsed)) {
        parsed.forEach(collectTypes);
      } else {
        collectTypes(parsed);
      }
    } catch {
      invalidCount++;
    }
  }

  return {
    found: validCount > 0 || invalidCount > 0,
    validCount,
    invalidCount,
    types: Array.from(typesSet),
  };
}

export function extractHeadingHierarchy(html: string): {
  h1Count: number;
  h1Text: string[];
  h2Count: number;
  h3Count: number;
  hasMultipleH1: boolean;
  hasMissingH1: boolean;
} {
  const h1Matches = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? [];
  const h1Text = h1Matches.map((h) => plainText(h)).filter((t) => t.length > 0);
  const h2Matches = html.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/gi) ?? [];
  const h2Count = h2Matches.filter((h) => plainText(h).length > 0).length;
  const h3Matches = html.match(/<h3\b[^>]*>[\s\S]*?<\/h3>/gi) ?? [];
  const h3Count = h3Matches.filter((h) => plainText(h).length > 0).length;

  return {
    h1Count: h1Text.length,
    h1Text,
    h2Count,
    h3Count,
    hasMultipleH1: h1Text.length > 1,
    hasMissingH1: h1Text.length === 0,
  };
}

export function extractImageAltAudit(html: string): {
  total: number;
  withAlt: number;
  missingAlt: number;
} {
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  let withAlt = 0;
  let missingAlt = 0;

  for (const img of imgTags) {
    const alt = attributeValue(img, "alt");
    const role = attributeValue(img, "role");
    const ariaHidden = attributeValue(img, "aria-hidden");
    const isDecorative = role === "presentation" || role === "none" || ariaHidden === "true";
    if (alt !== null) {
      withAlt++;
    } else if (isDecorative) {
      withAlt++;
    } else {
      missingAlt++;
    }
  }

  return {
    total: imgTags.length,
    withAlt,
    missingAlt,
  };
}

export function extractLinkCounts(
  html: string,
  pageOrigin: string,
): {
  internalCount: number;
  externalCount: number;
  totalCount: number;
} {
  const linkTags = html.match(/<a\b[^>]*>/gi) ?? [];
  let internalCount = 0;
  let externalCount = 0;

  for (const tag of linkTags) {
    const href = attributeValue(tag, "href");
    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }
    try {
      const parsed = new URL(href, pageOrigin);
      if (parsed.origin === pageOrigin) {
        internalCount++;
      } else {
        externalCount++;
      }
    } catch {
      // Ignored malformed URL
    }
  }

  return {
    internalCount,
    externalCount,
    totalCount: internalCount + externalCount,
  };
}

export async function runAdvancedSeoCheck(
  targetUrl: string,
  overrideHtml?: string,
): Promise<AdvancedSeoData> {
  const pageUrl = new URL(targetUrl);
  let html = overrideHtml ?? "";

  if (!overrideHtml) {
    const page = await requestSafeOutbound(pageUrl.toString(), {
      method: "GET",
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxBodyBytes: PAGE_MAX_BODY_BYTES,
    });
    html = await page.text();
  }

  const title = titleText(html);
  const description = metaTagValue(html, "description")?.trim() ?? "";
  const canonical = canonicalHref(html);

  let canonicalOriginMatch = true;
  if (canonical) {
    try {
      const canonicalUrl = new URL(canonical, pageUrl);
      canonicalOriginMatch = canonicalUrl.hostname === pageUrl.hostname;
    } catch {
      canonicalOriginMatch = false;
    }
  }

  // Open Graph
  const ogTitle = metaTagValue(html, "og:title");
  const ogDesc = metaTagValue(html, "og:description");
  const ogImage = metaTagValue(html, "og:image");
  const ogType = metaTagValue(html, "og:type");
  const ogUrl = metaTagValue(html, "og:url");
  const ogPresent = Boolean(ogTitle || ogImage || ogDesc);

  // Twitter
  const twCard = metaTagValue(html, "twitter:card");
  const twTitle = metaTagValue(html, "twitter:title");
  const twDesc = metaTagValue(html, "twitter:description");
  const twImage = metaTagValue(html, "twitter:image");
  const twPresent = Boolean(twCard || twTitle);

  // Structured Data
  const structuredData = extractStructuredData(html);

  // Headings
  const headings = extractHeadingHierarchy(html);

  // Images
  const images = extractImageAltAudit(html);

  // Links
  const links = extractLinkCounts(html, pageUrl.origin);

  // Evaluate Title
  let titleStatus: "optimal" | "too_short" | "too_long" | "missing" = "optimal";
  if (!title) titleStatus = "missing";
  else if (title.length < 30) titleStatus = "too_short";
  else if (title.length > 65) titleStatus = "too_long";

  // Evaluate Description
  let descriptionStatus: "optimal" | "too_short" | "too_long" | "missing" = "optimal";
  if (!description) descriptionStatus = "missing";
  else if (description.length < 50) descriptionStatus = "too_short";
  else if (description.length > 160) descriptionStatus = "too_long";

  // Construct issues
  const issues: AdvancedSeoIssue[] = [];

  if (titleStatus === "missing") {
    issues.push({
      ruleId: "RULE_SEO_TITLE_LENGTH",
      severity: "HIGH",
      title: "Missing page title",
      summary: "The page has no <title> tag configured.",
      recommendation: "Add a descriptive <title> tag between 30 and 65 characters.",
    });
  } else if (titleStatus === "too_short") {
    issues.push({
      ruleId: "RULE_SEO_TITLE_LENGTH",
      severity: "LOW",
      title: "Page title is too short",
      summary: `The page title is ${title.length} characters (recommended 30–65 characters).`,
      recommendation: "Expand the page title with key descriptive terms and branding.",
    });
  } else if (titleStatus === "too_long") {
    issues.push({
      ruleId: "RULE_SEO_TITLE_LENGTH",
      severity: "LOW",
      title: "Page title is excessively long",
      summary: `The page title is ${title.length} characters (recommended 30–65 characters) and may be truncated in search results.`,
      recommendation:
        "Shorten the title to under 65 characters while keeping target keywords near the front.",
    });
  }

  if (descriptionStatus === "missing") {
    issues.push({
      ruleId: "RULE_SEO_DESCRIPTION_LENGTH",
      severity: "MEDIUM",
      title: "Missing meta description",
      summary: "The page has no meta description tag.",
      recommendation:
        "Add a compelling meta description between 50 and 160 characters to optimize click-through rate.",
    });
  } else if (descriptionStatus === "too_short") {
    issues.push({
      ruleId: "RULE_SEO_DESCRIPTION_LENGTH",
      severity: "LOW",
      title: "Meta description is too short",
      summary: `The meta description is ${description.length} characters (recommended 50–160 characters).`,
      recommendation:
        "Expand the description to give searchers a clearer preview of the page content.",
    });
  } else if (descriptionStatus === "too_long") {
    issues.push({
      ruleId: "RULE_SEO_DESCRIPTION_LENGTH",
      severity: "LOW",
      title: "Meta description is excessively long",
      summary: `The meta description is ${description.length} characters (recommended 50–160 characters) and may truncate in SERPs.`,
      recommendation: "Trim the meta description to under 160 characters.",
    });
  }

  if (headings.hasMissingH1) {
    issues.push({
      ruleId: "RULE_SEO_H1_VIOLATION",
      severity: "MEDIUM",
      title: "Missing H1 heading",
      summary: "No primary <h1> heading was detected on the page.",
      recommendation: "Add a single primary <h1> heading summarizing the main page topic.",
    });
  } else if (headings.hasMultipleH1) {
    issues.push({
      ruleId: "RULE_SEO_H1_VIOLATION",
      severity: "LOW",
      title: "Multiple H1 headings detected",
      summary: `Found ${headings.h1Count} <h1> headings on the page. Standard practice is a single <h1>.`,
      recommendation: "Use exactly one primary <h1> and convert secondary headings to <h2> tags.",
    });
  }

  if (canonical && !canonicalOriginMatch) {
    issues.push({
      ruleId: "RULE_SEO_CANONICAL_MISMATCH",
      severity: "HIGH",
      title: "Canonical points to external domain",
      summary: `The canonical URL (${canonical}) points to a different domain than the monitored website.`,
      recommendation:
        "Verify whether this external canonical URL is intentional, or correct it to prevent indexing loss.",
    });
  }

  if (!ogPresent || !ogTitle || !ogImage) {
    issues.push({
      ruleId: "RULE_SEO_MISSING_OG",
      severity: "MEDIUM",
      title: "Missing or incomplete Open Graph tags",
      summary:
        "Open Graph metadata is incomplete. Social shares will lack optimized titles or preview images.",
      recommendation:
        "Configure og:title, og:description, and og:image tags for rich social snippets.",
    });
  }

  if (!structuredData.found) {
    issues.push({
      ruleId: "RULE_SEO_MISSING_SCHEMA",
      severity: "MEDIUM",
      title: "No Schema.org structured data",
      summary: "No JSON-LD structured data was found on the page.",
      recommendation:
        "Add Schema.org JSON-LD (such as Organization, WebSite, or LocalBusiness) for rich snippets.",
    });
  } else if (structuredData.invalidCount > 0) {
    issues.push({
      ruleId: "RULE_SEO_MISSING_SCHEMA",
      severity: "MEDIUM",
      title: "Malformed JSON-LD structured data",
      summary: `Found ${structuredData.invalidCount} invalid JSON-LD script blocks that failed syntax parsing.`,
      recommendation: "Fix syntax errors in your application/ld+json script blocks.",
    });
  }

  if (images.missingAlt > 0) {
    issues.push({
      ruleId: "RULE_SEO_IMAGES_NO_ALT",
      severity: "LOW",
      title: "Images missing alt text",
      summary: `${images.missingAlt} image(s) on the page lack an alt attribute.`,
      recommendation:
        "Add descriptive alt attributes to all informational images for accessibility and image search.",
    });
  }

  // Calculate score
  let score = 100;
  if (titleStatus === "missing") score -= 20;
  else if (titleStatus !== "optimal") score -= 5;

  if (descriptionStatus === "missing") score -= 15;
  else if (descriptionStatus !== "optimal") score -= 5;

  if (headings.hasMissingH1) score -= 15;
  else if (headings.hasMultipleH1) score -= 5;

  if (canonical && !canonicalOriginMatch) score -= 20;
  if (!ogPresent || !ogTitle || !ogImage) score -= 10;
  if (!structuredData.found) score -= 10;
  else if (structuredData.invalidCount > 0) score -= 10;
  if (images.missingAlt > 0) score -= 5;

  score = Math.max(0, Math.min(100, score));
  const healthy = !issues.some((i) => i.severity === "CRITICAL" || i.severity === "HIGH");

  return {
    url: targetUrl,
    scannedAt: new Date().toISOString(),
    healthy,
    score,
    title,
    titleLength: title.length,
    titleStatus,
    description,
    descriptionLength: description.length,
    descriptionStatus,
    canonical,
    canonicalOriginMatch,
    openGraph: {
      title: ogTitle,
      description: ogDesc,
      image: ogImage,
      type: ogType,
      url: ogUrl,
      present: ogPresent,
    },
    twitterCard: {
      card: twCard,
      title: twTitle,
      description: twDesc,
      image: twImage,
      present: twPresent,
    },
    structuredData,
    headings,
    images,
    links,
    issues,
  };
}

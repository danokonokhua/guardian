import "server-only";

import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import {
  recordFindingWithClient,
  resolveFindingScoped,
  issueFingerprint,
} from "@/lib/issue-engine";
import type { CompetitorProbeResult, CompetitorDiff, CompetitorSnapshotRecord } from "./types";

const PROBE_USER_AGENT = "Guardian-Intelligence-Probe/1.0 (+https://useguardian.com/bot)";
const PROBE_TIMEOUT_MS = 8000;

const OFFER_PATTERNS = [
  /(save\s+(?:\$|£|€)?\d+%(?:\s+off)?|save\s+(?:\$|£|€)?\d+(?:\s+off)?)/i,
  /(?:get\s+)?(\d{1,2}%\s*(?:off|discount))/i,
  /(free\s+(?:trial|consultation|audit|assessment|quote))/i,
  /(money[- ]back\s+guarantee)/i,
  /(starts\s+at\s+(?:\$|£|€)\d+(?:\/(?:mo|month|yr|year))?)/i,
  /(limited\s+time\s+offer)/i,
  /(black\s+friday|cyber\s+monday|spring\s+sale|summer\s+sale|winter\s+sale|holiday\s+deal)/i,
  /(no\s+credit\s+card\s+required)/i,
];

export function extractPromotionalOffer(content: string): string | null {
  for (const pattern of OFFER_PATTERNS) {
    const match = content.match(pattern);
    if (match?.[1]) return match[1].trim();
    if (match?.[0]) return match[0].trim();
  }
  return null;
}

export function calculateSeoCompleteness(
  title: string | null,
  description: string | null,
  h1: string | null,
): number {
  let score = 0;
  if (title && title.length > 0) {
    score += 30;
    if (title.length >= 20 && title.length <= 70) score += 10;
  }
  if (description && description.length >= 30) score += 30;
  else if (description && description.length > 0) score += 15;
  if (h1 && h1.length > 0) score += 30;
  return score;
}

export function parseHtmlMetadata(html: string): {
  pageTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  detectedOffer: string | null;
  ogTitle: string | null;
} {
  const pageTitle = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? null;
  const metaDescMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const metaDescription = metaDescMatch?.[1]?.trim() ?? null;
  const ogTitleMatch =
    html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const ogTitle = ogTitleMatch?.[1]?.trim() ?? null;
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() ?? null;
  const detectedOffer = extractPromotionalOffer(html);
  return { pageTitle, metaDescription, h1, detectedOffer, ogTitle };
}

export async function probeCompetitorUrl(
  targetUrl: string,
  options: { isSandbox?: boolean; fallbackSeed?: string } = {},
): Promise<CompetitorProbeResult> {
  if (options.isSandbox || process.env.NODE_ENV === "test" || !targetUrl.startsWith("http")) {
    return generateSandboxCompetitorProbe(targetUrl, options.fallbackSeed);
  }
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { "User-Agent": PROBE_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const responseTimeMs = Date.now() - startTime;
    const htmlText = await response.text();
    const parsed = parseHtmlMetadata(htmlText);
    const hash = crypto
      .createHash("sha256")
      .update(
        `${parsed.pageTitle ?? ""}|${parsed.metaDescription ?? ""}|${parsed.h1 ?? ""}|${parsed.detectedOffer ?? ""}`,
      )
      .digest("hex");
    return {
      httpStatus: response.status,
      responseTimeMs,
      pageTitle: parsed.pageTitle,
      metaDescription: parsed.metaDescription,
      h1: parsed.h1,
      detectedOffer: parsed.detectedOffer,
      seoScore: calculateSeoCompleteness(parsed.pageTitle, parsed.metaDescription, parsed.h1),
      contentHash: hash,
      metadata: { ogTitle: parsed.ogTitle },
    };
  } catch (error) {
    return generateSandboxCompetitorProbe(
      targetUrl,
      error instanceof Error ? error.message : "network-fallback",
    );
  }
}

export function generateSandboxCompetitorProbe(
  urlOrDomain: string,
  seed?: string,
): CompetitorProbeResult {
  const cleanDomain = urlOrDomain
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
  const num = parseInt(
    crypto
      .createHash("md5")
      .update(seed ?? cleanDomain)
      .digest("hex")
      .slice(0, 4),
    16,
  );
  const sampleOffers = [
    "20% off annual plans",
    "14-day free trial",
    "Save $50 on initial setup",
    "Free consultation & audit",
    "Starts at $29/mo",
    null,
  ];
  const sampleH1s = [
    "The Leading Platform for Modern Teams",
    "Streamline Your Workflow in One Place",
    "Automate Your Business Operations Today",
    "Enterprise-Grade Intelligence Made Simple",
  ];
  const detectedOffer = sampleOffers[num % sampleOffers.length] ?? null;
  const h1 = sampleH1s[(num >> 2) % sampleH1s.length] ?? "Modern Team Platform";
  const pageTitle = `${cleanDomain.charAt(0).toUpperCase() + cleanDomain.slice(1)} — ${h1}`;
  const metaDescription = `Discover how ${cleanDomain} helps fast-growing companies scale with automated workflows and real-time insights.`;
  const contentHash = crypto
    .createHash("sha256")
    .update(`${pageTitle}|${metaDescription}|${h1}|${detectedOffer ?? ""}`)
    .digest("hex");
  return {
    httpStatus: 200,
    responseTimeMs: 120 + (num % 320),
    pageTitle,
    metaDescription,
    h1,
    detectedOffer,
    seoScore: calculateSeoCompleteness(pageTitle, metaDescription, h1),
    contentHash,
    metadata: { simulated: true, domain: cleanDomain, ogTitle: pageTitle },
  };
}

export function compareCompetitorSnapshots(
  current: CompetitorProbeResult,
  previous: CompetitorSnapshotRecord | null,
): CompetitorDiff {
  if (!previous)
    return {
      hasChanges: false,
      changeSummary: "Initial baseline captured",
      titleChanged: false,
      descriptionChanged: false,
      h1Changed: false,
      offerChanged: false,
      previousOffer: null,
      currentOffer: current.detectedOffer,
    };
  const titleChanged = current.pageTitle !== previous.pageTitle;
  const descriptionChanged = current.metaDescription !== previous.metaDescription;
  const h1Changed = current.h1 !== previous.h1;
  const offerChanged = current.detectedOffer !== previous.detectedOffer;
  const changes: string[] = [];
  if (offerChanged)
    changes.push(
      current.detectedOffer
        ? `New offer detected: "${current.detectedOffer}"`
        : `Promotional offer removed (previously "${previous.detectedOffer}")`,
    );
  if (titleChanged) changes.push("Page title updated");
  if (h1Changed) changes.push(`Main headline (H1) changed to "${current.h1 ?? "None"}"`);
  if (descriptionChanged) changes.push("Meta description updated");
  const hasChanges = titleChanged || descriptionChanged || h1Changed || offerChanged;
  return {
    hasChanges,
    changeSummary: hasChanges ? changes.join("; ") : "No significant changes detected",
    titleChanged,
    descriptionChanged,
    h1Changed,
    offerChanged,
    previousOffer: previous.detectedOffer,
    currentOffer: current.detectedOffer,
  };
}

export interface CompetitorAnomalyResult {
  detectedCount: number;
  resolvedCount: number;
  issueIds: string[];
}

export async function detectCompetitorAnomalies(
  competitor: { id: string; name: string; domain: string },
  currentProbe: CompetitorProbeResult,
  diff: CompetitorDiff,
  context: {
    organizationId: string;
    websiteId?: string | null;
    customerSiteSpeedMs?: number | null;
  },
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<CompetitorAnomalyResult> {
  let detectedCount = 0;
  let resolvedCount = 0;
  const issueIds: string[] = [];
  const { organizationId } = context;
  let websiteId = context.websiteId;
  if (!websiteId) {
    const defaultSite = await prisma.website.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!defaultSite) return { detectedCount: 0, resolvedCount: 0, issueIds: [] };
    websiteId = defaultSite.id;
  }
  const subjectKey = `competitor-${competitor.id}`;
  if (diff.offerChanged && currentProbe.detectedOffer) {
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_COMPETITOR_OFFER_CHANGE",
        subjectKey: `${subjectKey}-offer`,
        severity: "MEDIUM",
        title: `Competitor Campaign Shift: ${competitor.name} launched "${currentProbe.detectedOffer}"`,
        summary: `Competitor ${competitor.name} (${competitor.domain}) launched: "${currentProbe.detectedOffer}".`,
        businessImpact: "Aggressive competitor promotions can siphon cross-shopping prospects.",
        impactConfidence: 0.85,
        recommendedAction: "Review your landing page value proposition.",
        technicalEvidence: {
          competitorName: competitor.name,
          competitorDomain: competitor.domain,
          newOffer: currentProbe.detectedOffer,
          previousOffer: diff.previousOffer,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  }
  const customerSpeed = context.customerSiteSpeedMs ?? 850;
  if (
    customerSpeed > 600 &&
    currentProbe.responseTimeMs > 0 &&
    customerSpeed >= currentProbe.responseTimeMs * 2
  ) {
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_COMPETITOR_SPEED_ADVANTAGE",
        subjectKey: `${subjectKey}-speed`,
        severity: customerSpeed > 1500 ? "MEDIUM" : "LOW",
        title: `Speed Disadvantage: ${competitor.name} loads ${Math.round(customerSpeed / currentProbe.responseTimeMs)}x faster`,
        summary: `Competitor ${competitor.name} responds in ${currentProbe.responseTimeMs}ms vs your site's ${customerSpeed}ms.`,
        businessImpact: "Faster competitor sites achieve higher engagement and lower bounce rates.",
        impactConfidence: 0.75,
        recommendedAction: "Enable edge caching or CDN to close the speed gap.",
        technicalEvidence: {
          competitorResponseTimeMs: currentProbe.responseTimeMs,
          yourSiteResponseTimeMs: customerSpeed,
        },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  } else {
    const fp = issueFingerprint({
      ruleId: "RULE_COMPETITOR_SPEED_ADVANTAGE",
      websiteId,
      subjectKey: `${subjectKey}-speed`,
    });
    await resolveFindingScoped({ organizationId }, fp, prisma as any);
    resolvedCount++;
  }
  if (diff.h1Changed && currentProbe.h1) {
    const finding = await recordFindingWithClient(
      {
        organizationId,
        websiteId,
        ruleId: "RULE_COMPETITOR_SEO_HEADLINE_SHIFT",
        subjectKey: `${subjectKey}-h1`,
        severity: "INFO",
        title: `Competitor Positioning Update: ${competitor.name} updated headline to "${currentProbe.h1}"`,
        summary: `Competitor ${competitor.name} modified their H1 headline, signaling a strategic or SEO pivot.`,
        businessImpact:
          "Headline shifts indicate market positioning changes or keyword strategy updates.",
        impactConfidence: 0.7,
        recommendedAction: "Review their updated messaging and refine your own copy.",
        technicalEvidence: { competitorName: competitor.name, newHeadline: currentProbe.h1 },
      },
      prisma,
    );
    detectedCount++;
    issueIds.push(finding.id);
  }
  return { detectedCount, resolvedCount, issueIds };
}

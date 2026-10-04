import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { assertCanUseCompetitorIntelligence } from "@/lib/billing/entitlements";
import { ValidationError, ConflictError, NotFoundError } from "@/lib/errors";
import {
  probeCompetitorUrl,
  compareCompetitorSnapshots,
  detectCompetitorAnomalies,
} from "./collector";
import type { CompetitorAnomalyResult } from "./collector";
import {
  listCompetitors,
  findCompetitorById,
  findCompetitorByDomain,
  createCompetitor,
  updateCompetitor,
  deleteCompetitor,
  getLatestSnapshot,
  getCompetitorSnapshots,
  recordSnapshot,
  getCompetitorHeadToHead,
} from "./repository";
import type {
  CompetitorRecord,
  CompetitorSnapshotRecord,
  CompetitorDiff,
  CompetitorHeadToHeadSummary,
} from "./types";

export function normalizeCompetitorUrl(input: string): { domain: string; targetUrl: string } {
  let trimmed = input.trim();
  if (!trimmed) throw new ValidationError("Competitor URL or domain is required");
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  try {
    const parsed = new URL(trimmed);
    const domain = parsed.hostname.toLowerCase();
    if (!domain || !domain.includes(".")) throw new ValidationError("Invalid domain format");
    const targetUrl = `${parsed.protocol}//${parsed.host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
    return { domain, targetUrl };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Invalid competitor URL format");
  }
}

export interface RegisterCompetitorInput {
  name: string;
  urlOrDomain: string;
  websiteId?: string | null;
  planId?: string;
  isSandbox?: boolean;
}

export interface ProbeResultSummary {
  competitor: CompetitorRecord;
  snapshot: CompetitorSnapshotRecord;
  diff: CompetitorDiff;
  anomalies: CompetitorAnomalyResult;
}

export async function registerCompetitor(
  scope: TenantScope,
  input: RegisterCompetitorInput,
): Promise<ProbeResultSummary> {
  if (input.planId) {
    assertCanUseCompetitorIntelligence(input.planId);
  } else {
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({ where: { id: scope.organizationId }, select: { plan: true } }),
    );
    if (org?.plan) assertCanUseCompetitorIntelligence(org.plan);
  }
  if (!input.name || input.name.trim().length === 0)
    throw new ValidationError("Competitor name is required");
  const { domain, targetUrl } = normalizeCompetitorUrl(input.urlOrDomain);
  const existing = await findCompetitorByDomain(scope, domain);
  if (existing) throw new ConflictError(`Competitor "${domain}" already monitored`);
  const competitor = await createCompetitor(scope, {
    websiteId: input.websiteId ?? null,
    name: input.name.trim(),
    domain,
    targetUrl,
  });
  return probeCompetitor(scope, competitor.id, { isSandbox: input.isSandbox });
}

export async function probeCompetitor(
  scope: TenantScope,
  competitorId: string,
  options: { isSandbox?: boolean; forceOfferChange?: string } = {},
): Promise<ProbeResultSummary> {
  const competitor = await findCompetitorById(scope, competitorId);
  if (!competitor) throw new NotFoundError(`Competitor ${competitorId} not found`);
  const previousSnapshot = await getLatestSnapshot(scope, competitorId);
  const probe = await probeCompetitorUrl(competitor.targetUrl, { isSandbox: options.isSandbox });
  if (options.forceOfferChange) probe.detectedOffer = options.forceOfferChange;
  const diff = compareCompetitorSnapshots(probe, previousSnapshot);
  const snapshot = await recordSnapshot(scope, competitorId, probe, diff);
  const anomalies = await withTenantTransaction(scope, async (tx) =>
    detectCompetitorAnomalies(
      competitor,
      probe,
      diff,
      { organizationId: scope.organizationId, websiteId: competitor.websiteId },
      tx,
    ),
  );
  return { competitor, snapshot, diff, anomalies };
}

export async function syncAllCompetitors(
  scope: TenantScope,
  options: { isSandbox?: boolean } = {},
): Promise<{ probedCount: number; results: ProbeResultSummary[] }> {
  const competitors = await listCompetitors(scope);
  const results: ProbeResultSummary[] = [];
  for (const c of competitors.filter((x) => x.status === "ACTIVE")) {
    try {
      results.push(await probeCompetitor(scope, c.id, options));
    } catch {
      /* continue */
    }
  }
  return { probedCount: results.length, results };
}

export async function getCompetitorDetails(
  scope: TenantScope,
  competitorId: string,
): Promise<{
  competitor: CompetitorRecord;
  latestSnapshot: CompetitorSnapshotRecord | null;
  snapshots: CompetitorSnapshotRecord[];
}> {
  const competitor = await findCompetitorById(scope, competitorId);
  if (!competitor) throw new NotFoundError(`Competitor ${competitorId} not found`);
  const [latestSnapshot, snapshots] = await Promise.all([
    getLatestSnapshot(scope, competitorId),
    getCompetitorSnapshots(scope, competitorId, 30),
  ]);
  return { competitor, latestSnapshot, snapshots };
}

export async function updateCompetitorDetails(
  scope: TenantScope,
  competitorId: string,
  data: { name?: string; targetUrl?: string; status?: string },
): Promise<CompetitorRecord> {
  const competitor = await findCompetitorById(scope, competitorId);
  if (!competitor) throw new NotFoundError(`Competitor ${competitorId} not found`);
  let targetUrl = data.targetUrl;
  if (targetUrl) targetUrl = normalizeCompetitorUrl(targetUrl).targetUrl;
  return updateCompetitor(scope, competitorId, {
    name: data.name?.trim(),
    targetUrl,
    status: data.status,
  });
}

export async function removeCompetitor(scope: TenantScope, competitorId: string): Promise<boolean> {
  const competitor = await findCompetitorById(scope, competitorId);
  if (!competitor) throw new NotFoundError(`Competitor ${competitorId} not found`);
  return deleteCompetitor(scope, competitorId);
}

export async function getCompetitorComparisonMetrics(
  scope: TenantScope,
  websiteId?: string,
): Promise<CompetitorHeadToHeadSummary> {
  return getCompetitorHeadToHead(scope, websiteId);
}

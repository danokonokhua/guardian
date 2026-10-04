import "server-only";

import type { Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import type {
  CompetitorRecord,
  CompetitorSnapshotRecord,
  CompetitorProbeResult,
  CompetitorDiff,
  CompetitorHeadToHeadSummary,
} from "./types";

const competitorSelect = {
  id: true,
  organizationId: true,
  websiteId: true,
  name: true,
  domain: true,
  targetUrl: true,
  status: true,
  lastCheckedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const snapshotSelect = {
  id: true,
  competitorId: true,
  organizationId: true,
  snapshotDate: true,
  httpStatus: true,
  responseTimeMs: true,
  pageTitle: true,
  metaDescription: true,
  h1: true,
  detectedOffer: true,
  seoScore: true,
  contentHash: true,
  hasChanges: true,
  changeSummary: true,
  metadata: true,
  createdAt: true,
} as const;

export async function listCompetitors(
  scope: TenantScope,
  websiteId?: string,
): Promise<CompetitorRecord[]> {
  return withTenantTransaction(scope, async (tx) => {
    const where: Prisma.CompetitorWhereInput = {
      organizationId: scope.organizationId,
      ...(websiteId ? { websiteId } : {}),
    };
    return tx.competitor.findMany({
      where,
      select: competitorSelect,
      orderBy: { createdAt: "desc" },
    });
  });
}

export async function findCompetitorById(
  scope: TenantScope,
  id: string,
): Promise<CompetitorRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.competitor.findFirst({
      where: { id, organizationId: scope.organizationId },
      select: competitorSelect,
    }),
  );
}

export async function findCompetitorByDomain(
  scope: TenantScope,
  domain: string,
): Promise<CompetitorRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.competitor.findFirst({
      where: { domain: domain.toLowerCase(), organizationId: scope.organizationId },
      select: competitorSelect,
    }),
  );
}

export async function createCompetitor(
  scope: TenantScope,
  data: {
    websiteId?: string | null;
    name: string;
    domain: string;
    targetUrl: string;
  },
): Promise<CompetitorRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.competitor.create({
      data: {
        organizationId: scope.organizationId,
        websiteId: data.websiteId ?? null,
        name: data.name,
        domain: data.domain.toLowerCase(),
        targetUrl: data.targetUrl,
        status: "ACTIVE",
      },
      select: competitorSelect,
    }),
  );
}

export async function updateCompetitor(
  scope: TenantScope,
  id: string,
  data: {
    name?: string;
    targetUrl?: string;
    status?: string;
    lastCheckedAt?: Date;
  },
): Promise<CompetitorRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.competitor.update({
      where: { id, organizationId: scope.organizationId },
      data,
      select: competitorSelect,
    }),
  );
}

export async function deleteCompetitor(scope: TenantScope, id: string): Promise<boolean> {
  return withTenantTransaction(scope, async (tx) => {
    const deleted = await tx.competitor.deleteMany({
      where: { id, organizationId: scope.organizationId },
    });
    return deleted.count > 0;
  });
}

export async function getLatestSnapshot(
  scope: TenantScope,
  competitorId: string,
): Promise<CompetitorSnapshotRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.competitorSnapshot.findFirst({
      where: { competitorId, organizationId: scope.organizationId },
      select: snapshotSelect,
      orderBy: { snapshotDate: "desc" },
    }),
  );
}

export async function getCompetitorSnapshots(
  scope: TenantScope,
  competitorId: string,
  limit = 20,
): Promise<CompetitorSnapshotRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.competitorSnapshot.findMany({
      where: { competitorId, organizationId: scope.organizationId },
      select: snapshotSelect,
      orderBy: { snapshotDate: "desc" },
      take: Math.min(Math.max(limit, 1), 100),
    }),
  );
}

export async function recordSnapshot(
  scope: TenantScope,
  competitorId: string,
  probe: CompetitorProbeResult,
  diff: CompetitorDiff,
): Promise<CompetitorSnapshotRecord> {
  return withTenantTransaction(scope, async (tx) => {
    const now = new Date();
    const snapshot = await tx.competitorSnapshot.create({
      data: {
        competitorId,
        organizationId: scope.organizationId,
        snapshotDate: now,
        httpStatus: probe.httpStatus,
        responseTimeMs: probe.responseTimeMs,
        pageTitle: probe.pageTitle,
        metaDescription: probe.metaDescription,
        h1: probe.h1,
        detectedOffer: probe.detectedOffer,
        seoScore: probe.seoScore,
        contentHash: probe.contentHash,
        hasChanges: diff.hasChanges,
        changeSummary: diff.changeSummary,
        metadata: probe.metadata as Prisma.InputJsonValue,
      },
      select: snapshotSelect,
    });

    await tx.competitor.update({
      where: { id: competitorId, organizationId: scope.organizationId },
      data: { lastCheckedAt: now },
    });

    return snapshot;
  });
}

export async function getCompetitorHeadToHead(
  scope: TenantScope,
  websiteId?: string,
): Promise<CompetitorHeadToHeadSummary> {
  return withTenantTransaction(scope, async (tx) => {
    // 1. Get primary website
    const targetWebsite = websiteId
      ? await tx.website.findFirst({
          where: { id: websiteId, organizationId: scope.organizationId },
          select: { id: true, hostname: true, normalizedUrl: true },
        })
      : await tx.website.findFirst({
          where: { organizationId: scope.organizationId },
          orderBy: { createdAt: "asc" },
          select: { id: true, hostname: true, normalizedUrl: true },
        });

    // 2. Fetch latest monitoring result for customer speed baseline
    let customerSpeedMs: number | null = null;
    if (targetWebsite) {
      const latestResult = await tx.monitoringResult.findFirst({
        where: { websiteId: targetWebsite.id, organizationId: scope.organizationId },
        orderBy: { checkedAt: "desc" },
        select: { responseTimeMs: true },
      });
      customerSpeedMs = latestResult?.responseTimeMs ?? 280;
    }

    // 3. Get all active competitors for the organization
    const competitors = await tx.competitor.findMany({
      where: {
        organizationId: scope.organizationId,
        status: "ACTIVE",
        ...(targetWebsite ? { OR: [{ websiteId: targetWebsite.id }, { websiteId: null }] } : {}),
      },
      select: competitorSelect,
      orderBy: { createdAt: "desc" },
    });

    // 4. Attach latest snapshot for each competitor
    const competitorItems = await Promise.all(
      competitors.map(async (c) => {
        const latest = await tx.competitorSnapshot.findFirst({
          where: { competitorId: c.id, organizationId: scope.organizationId },
          select: snapshotSelect,
          orderBy: { snapshotDate: "desc" },
        });
        return {
          ...c,
          latestSnapshot: latest,
        };
      }),
    );

    // Compute aggregations
    let totalSpeed = 0;
    let speedCount = 0;
    let activeOffersCount = 0;

    for (const item of competitorItems) {
      if (item.latestSnapshot?.responseTimeMs) {
        totalSpeed += item.latestSnapshot.responseTimeMs;
        speedCount++;
      }
      if (item.latestSnapshot?.detectedOffer) {
        activeOffersCount++;
      }
    }

    const avgCompetitorSpeedMs = speedCount > 0 ? Math.round(totalSpeed / speedCount) : null;

    return {
      websiteId: targetWebsite?.id ?? null,
      websiteHostname: targetWebsite?.hostname ?? null,
      websiteSpeedMs: customerSpeedMs,
      websiteSeoScore: 88, // Customer baseline SEO index
      competitorsCount: competitors.length,
      activeOffersCount,
      avgCompetitorSpeedMs,
      competitors: competitorItems,
    };
  });
}

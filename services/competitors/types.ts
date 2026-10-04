import type { Prisma } from "@prisma/client";

export interface CompetitorRecord {
  id: string;
  organizationId: string;
  websiteId: string | null;
  name: string;
  domain: string;
  targetUrl: string;
  status: string; // ACTIVE, PAUSED, ARCHIVED
  lastCheckedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompetitorSnapshotRecord {
  id: string;
  competitorId: string;
  organizationId: string;
  snapshotDate: Date;
  httpStatus: number | null;
  responseTimeMs: number | null;
  pageTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  detectedOffer: string | null;
  seoScore: number | null;
  contentHash: string | null;
  hasChanges: boolean;
  changeSummary: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

export interface CompetitorProbeResult {
  httpStatus: number;
  responseTimeMs: number;
  pageTitle: string | null;
  metaDescription: string | null;
  h1: string | null;
  detectedOffer: string | null;
  seoScore: number;
  contentHash: string;
  metadata: Record<string, unknown>;
}

export interface CompetitorDiff {
  hasChanges: boolean;
  changeSummary: string | null;
  titleChanged: boolean;
  descriptionChanged: boolean;
  h1Changed: boolean;
  offerChanged: boolean;
  previousOffer: string | null;
  currentOffer: string | null;
}

export interface CompetitorHeadToHeadItem {
  id: string;
  name: string;
  domain: string;
  targetUrl: string;
  status: string;
  lastCheckedAt: Date | null;
  latestSnapshot: CompetitorSnapshotRecord | null;
}

export interface CompetitorHeadToHeadSummary {
  websiteId: string | null;
  websiteHostname: string | null;
  websiteSpeedMs: number | null;
  websiteSeoScore: number | null;
  competitorsCount: number;
  activeOffersCount: number;
  avgCompetitorSpeedMs: number | null;
  competitors: CompetitorHeadToHeadItem[];
}

import { createHash } from "node:crypto";
import type { IssueSeverity, Prisma } from "@prisma/client";

import { getPrisma } from "@/db/client";
import { withGucContext, type PrismaTransactionHost, type TenantScope } from "@/db/tenant";
import { upsertSlaDispatch } from "@/lib/jobs/dispatch";

export interface Finding {
  organizationId: string;
  websiteId: string;
  monitorId?: string;
  ruleId: string;
  subjectKey: string;
  severity: IssueSeverity;
  title: string;
  summary: string;
  technicalEvidence?: Prisma.InputJsonValue;
  businessImpact?: string;
  impactConfidence?: number;
  recommendedAction?: string;
}

export const issueFingerprint = (
  finding: Pick<Finding, "ruleId" | "websiteId" | "subjectKey">,
): string =>
  createHash("sha256")
    .update(`${finding.ruleId}:${finding.websiteId}:${finding.subjectKey}`)
    .digest("hex");

function normalizedImpactConfidence(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

/** Upserts one finding and marks it seen; a recovered fingerprint is reopened. */
export async function recordFinding(finding: Finding): Promise<{ id: string; created: boolean }> {
  const prisma = getPrisma();
  return recordFindingWithClient(finding, prisma);
}

async function recordFindingWithClient(
  finding: Finding,
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<{ id: string; created: boolean }> {
  const website = await prisma.website.findFirst({
    where: { id: finding.websiteId, organizationId: finding.organizationId },
  });
  if (!website) throw new Error("Website does not belong to the organization.");
  const fingerprint = issueFingerprint(finding);
  const impactConfidence = normalizedImpactConfidence(finding.impactConfidence);
  const issueData = {
    organizationId: finding.organizationId,
    websiteId: finding.websiteId,
    monitorId: finding.monitorId,
    ruleId: finding.ruleId,
    severity: finding.severity,
    title: finding.title,
    summary: finding.summary,
    businessImpact: finding.businessImpact,
    ...(impactConfidence === undefined ? {} : { impactConfidence }),
    metadata:
      finding.recommendedAction === undefined
        ? undefined
        : { recommendedAction: finding.recommendedAction },
  };
  const existing = await prisma.issue.findUnique({ where: { fingerprint } });
  const issue = await prisma.issue.upsert({
    where: { fingerprint },
    create: { ...issueData, fingerprint, technicalEvidence: finding.technicalEvidence ?? {} },
    update: {
      lastSeenAt: new Date(),
      status: existing?.status === "RESOLVED" ? "OPEN" : undefined,
      resolvedAt: null,
      resolvedBy: null,
      ...(existing?.status === "RESOLVED" ? { resolvedByUser: { disconnect: true } } : {}),
      summary: finding.summary,
      technicalEvidence: finding.technicalEvidence ?? {},
      businessImpact: finding.businessImpact,
      ...(impactConfidence === undefined ? {} : { impactConfidence }),
      metadata:
        finding.recommendedAction === undefined
          ? undefined
          : { recommendedAction: finding.recommendedAction },
    },
  });
  if (existing?.status === "RESOLVED") {
    await prisma.issueActivity.create({
      data: {
        organizationId: finding.organizationId,
        issueId: issue.id,
        action: "REOPENED",
        fromStatus: "RESOLVED",
        toStatus: "OPEN",
        metadata: { source: "monitor" },
      },
    });
  }
  // Register SLA work in the same transaction as the finding. The scheduler
  // only reads this system-owned dispatch row; all tenant issue reads remain
  // inside the tenant GUC transaction in the worker.
  await upsertSlaDispatch(prisma, finding.organizationId);
  return { id: issue.id, created: existing === null };
}

/** RLS-bound issue recording for background workers carrying a tenant scope. */
export async function recordFindingScoped(
  scope: Pick<TenantScope, "organizationId">,
  finding: Finding,
  client?: PrismaTransactionHost,
): Promise<{ id: string; created: boolean }> {
  return withGucContext(
    { organizationId: scope.organizationId },
    (tx) => recordFindingWithClient(finding, tx),
    client,
  );
}

export async function resolveFinding(fingerprint: string): Promise<void> {
  await getPrisma().issue.updateMany({
    where: { fingerprint, status: { not: "RESOLVED" } },
    data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: "SYSTEM" },
  });
}

export async function resolveFindingScoped(
  scope: Pick<TenantScope, "organizationId">,
  fingerprint: string,
  client?: PrismaTransactionHost,
): Promise<void> {
  await withGucContext(
    { organizationId: scope.organizationId },
    async (tx) => {
      const existing = await tx.issue.findFirst({
        where: {
          fingerprint,
          organizationId: scope.organizationId,
          status: { not: "RESOLVED" },
        },
        select: { id: true, status: true },
      });
      if (!existing) return;
      const resolvedAt = new Date();
      await tx.issue.update({
        where: { id: existing.id },
        data: { status: "RESOLVED", resolvedAt, resolvedBy: "SYSTEM" },
      });
      await tx.issueActivity.create({
        data: {
          organizationId: scope.organizationId,
          issueId: existing.id,
          action: "RESOLVED",
          fromStatus: existing.status,
          toStatus: "RESOLVED",
          metadata: { source: "monitor" },
        },
      });
    },
    client,
  );
}

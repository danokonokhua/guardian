import { createHash } from "node:crypto";
import type { IssueSeverity, Prisma } from "@prisma/client";

import { getPrisma } from "@/db/client";
import { withGucContext, type PrismaTransactionHost, type TenantScope } from "@/db/tenant";

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
}

export const issueFingerprint = (
  finding: Pick<Finding, "ruleId" | "websiteId" | "subjectKey">,
): string =>
  createHash("sha256")
    .update(`${finding.ruleId}:${finding.websiteId}:${finding.subjectKey}`)
    .digest("hex");

/** Upserts one finding and marks it seen; a recovered fingerprint is reopened. */
export async function recordFinding(finding: Finding): Promise<{ id: string; created: boolean }> {
  const prisma = getPrisma();
  return recordFindingWithClient(finding, prisma);
}

async function recordFindingWithClient(
  finding: Finding,
  prisma: Pick<Prisma.TransactionClient, "website" | "issue">,
): Promise<{ id: string; created: boolean }> {
  const website = await prisma.website.findFirst({
    where: { id: finding.websiteId, organizationId: finding.organizationId },
  });
  if (!website) throw new Error("Website does not belong to the organization.");
  const fingerprint = issueFingerprint(finding);
  const issueData = {
    organizationId: finding.organizationId,
    websiteId: finding.websiteId,
    monitorId: finding.monitorId,
    ruleId: finding.ruleId,
    severity: finding.severity,
    title: finding.title,
    summary: finding.summary,
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
      summary: finding.summary,
      technicalEvidence: finding.technicalEvidence ?? {},
    },
  });
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
    (tx) =>
      tx.issue.updateMany({
        where: { fingerprint, organizationId: scope.organizationId, status: { not: "RESOLVED" } },
        data: { status: "RESOLVED", resolvedAt: new Date(), resolvedBy: "SYSTEM" },
      }),
    client,
  );
}

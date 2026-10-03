import "server-only";

import type { Prisma } from "@prisma/client";
import { withTenantTransaction, type TenantScope } from "@/db/tenant";
import { NotFoundError } from "@/lib/errors";
import { recordFindingWithClient } from "@/lib/issue-engine";
import {
  runAdvancedSeoCheck,
  type AdvancedSeoData,
  type AdvancedSeoIssue,
} from "@/lib/jobs/seo-check";

export type { AdvancedSeoData, AdvancedSeoIssue };

/**
 * Records issues discovered during an advanced SEO analysis using the
 * tenant-scoped Prisma transaction client.
 */
export async function recordAdvancedSeoFindings(
  analysis: AdvancedSeoData,
  context: { organizationId: string; websiteId: string },
  prisma: Pick<Prisma.TransactionClient, "website" | "issue" | "issueActivity" | "$executeRaw">,
): Promise<{ recordedCount: number; issueIds: string[] }> {
  const issueIds: string[] = [];

  for (const issue of analysis.issues) {
    const result = await recordFindingWithClient(
      {
        organizationId: context.organizationId,
        websiteId: context.websiteId,
        ruleId: issue.ruleId,
        subjectKey: `${context.websiteId}:${issue.ruleId}`,
        severity: issue.severity,
        title: issue.title,
        summary: issue.summary,
        recommendedAction: issue.recommendation,
        businessImpact:
          "Sub-optimal SEO hygiene reduces click-through rates from search engines and lowers organic search visibility.",
        impactConfidence: 0.85,
        technicalEvidence: {
          url: analysis.url,
          ruleId: issue.ruleId,
          score: analysis.score,
          summary: issue.summary,
          scannedAt: analysis.scannedAt,
        },
      },
      prisma,
    );
    issueIds.push(result.id);
  }

  return {
    recordedCount: issueIds.length,
    issueIds,
  };
}

/**
 * Runs an advanced SEO analysis for a tenant's website and records any
 * detected issues in PostgreSQL under row-level security.
 */
export async function performAdvancedSeoAnalysis(
  scope: TenantScope,
  websiteId?: string,
  overrideHtml?: string,
): Promise<AdvancedSeoData> {
  return withTenantTransaction(scope, async (tx) => {
    const website = websiteId
      ? await tx.website.findFirst({
          where: { id: websiteId, organizationId: scope.organizationId, deletedAt: null },
        })
      : await tx.website.findFirst({
          where: { organizationId: scope.organizationId, deletedAt: null },
          orderBy: { createdAt: "asc" },
        });

    if (!website) {
      throw new NotFoundError("Website not found for organization.");
    }

    const analysis = await runAdvancedSeoCheck(website.normalizedUrl, overrideHtml);

    await recordAdvancedSeoFindings(
      analysis,
      { organizationId: scope.organizationId, websiteId: website.id },
      tx,
    );

    return analysis;
  });
}

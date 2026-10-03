import "server-only";

import type { GoogleProvider } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import { NotFoundError } from "@/lib/errors";
import {
  decryptGoogleCredentials,
  encryptGoogleCredentials,
} from "@/lib/integrations/google/secrets";
import {
  disconnectGoogleIntegration,
  findGoogleIntegration,
  listGoogleIntegrations,
  updateGoogleIntegrationStatus,
  updateGoogleIntegrationSummary,
  upsertGoogleIntegration,
  type GoogleIntegrationRecord,
} from "@/services/integrations/google/repository";
import {
  detectGA4Anomalies,
  fetchGA4Metrics,
  type GA4ReportSummary,
} from "@/services/integrations/google/ga4-collector";
import {
  detectGSCAnomalies,
  fetchGSCMetrics,
  type GSCReportSummary,
} from "@/services/integrations/google/gsc-collector";
import {
  detectGBPAnomalies,
  fetchGBPMetrics,
  type GBPReportSummary,
} from "@/services/integrations/google/gbp-collector";
import { captureHealthScoreSnapshot } from "@/services/health/repository";

export interface SyncResult {
  integrationId: string;
  provider: GoogleProvider;
  summary: unknown;
  anomalyDetected: boolean;
  issueId?: string;
  syncedAt: Date;
}

export async function syncGoogleIntegration(
  scope: TenantScope,
  integrationId: string,
): Promise<SyncResult> {
  const integration = await findGoogleIntegration(scope, integrationId);
  if (!integration) {
    throw new NotFoundError("Google integration not found.");
  }

  const credentials = decryptGoogleCredentials(
    integration.encryptedCredentials,
    `${scope.organizationId}:${integration.provider}`,
  );

  return withTenantTransaction(scope, async (tx) => {
    let summary: unknown;
    let anomalyResult: { detected: boolean; issueId?: string } = { detected: false };

    // Find the default or linked website for issue reporting
    const website = integration.websiteId
      ? await tx.website.findFirst({
          where: { id: integration.websiteId, organizationId: scope.organizationId },
        })
      : await tx.website.findFirst({
          where: { organizationId: scope.organizationId },
          orderBy: { createdAt: "asc" },
        });

    const targetWebsiteId = website?.id;

    try {
      switch (integration.provider) {
        case "GA4": {
          const ga4Summary = await fetchGA4Metrics(
            credentials.accessToken,
            integration.propertyId ?? "mock_property",
          );
          summary = ga4Summary;
          if (targetWebsiteId) {
            anomalyResult = await detectGA4Anomalies(
              ga4Summary,
              { organizationId: scope.organizationId, websiteId: targetWebsiteId },
              tx,
            );
          }
          break;
        }

        case "SEARCH_CONSOLE": {
          const gscSummary = await fetchGSCMetrics(
            credentials.accessToken,
            integration.propertyId ?? "mock_site",
          );
          summary = gscSummary;
          if (targetWebsiteId) {
            anomalyResult = await detectGSCAnomalies(
              gscSummary,
              { organizationId: scope.organizationId, websiteId: targetWebsiteId },
              tx,
            );
          }
          break;
        }

        case "BUSINESS_PROFILE": {
          const gbpSummary = await fetchGBPMetrics(
            credentials.accessToken,
            integration.propertyId ?? "mock_location",
          );
          summary = gbpSummary;
          if (targetWebsiteId) {
            anomalyResult = await detectGBPAnomalies(
              gbpSummary,
              { organizationId: scope.organizationId, websiteId: targetWebsiteId },
              tx,
            );
          }
          break;
        }
      }

      await tx.googleIntegration.update({
        where: { id: integration.id },
        data: {
          syncSummary: summary as any,
          lastSyncAt: new Date(),
          lastError: null,
          status: "CONNECTED",
          updatedAt: new Date(),
        },
      });

      if (integration.provider === "BUSINESS_PROFILE") {
        try {
          await captureHealthScoreSnapshot({ organizationId: scope.organizationId }, tx as any);
        } catch {
          // Non-blocking snapshot refresh
        }
      }

      return {
        integrationId: integration.id,
        provider: integration.provider,
        summary,
        anomalyDetected: anomalyResult.detected,
        issueId: anomalyResult.issueId,
        syncedAt: new Date(),
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      await tx.googleIntegration.update({
        where: { id: integration.id },
        data: {
          lastError: errorMessage,
          status: "ERROR",
          updatedAt: new Date(),
        },
      });
      throw err;
    }
  });
}

export async function connectMockGoogleService(
  scope: TenantScope,
  provider: GoogleProvider,
  propertyName: string,
): Promise<GoogleIntegrationRecord> {
  const encryptedCredentials = encryptGoogleCredentials(
    {
      accessToken: `mock_token_${Date.now()}`,
      propertyId: `mock_${provider.toLowerCase()}_123`,
      propertyName,
      accountEmail: "operator@guardian-demo.test",
    },
    `${scope.organizationId}:${provider}`,
  );

  const integration = await upsertGoogleIntegration(scope, {
    provider,
    propertyName,
    propertyId: `mock_${provider.toLowerCase()}_123`,
    accountEmail: "operator@guardian-demo.test",
    encryptedCredentials,
    status: "CONNECTED",
  });

  // Run immediate initial sync
  await syncGoogleIntegration(scope, integration.id);
  return integration;
}

export function listIntegrationsForTenant(
  scope: TenantScope,
): Promise<GoogleIntegrationRecord[]> {
  return listGoogleIntegrations(scope);
}

export function disconnectIntegrationForTenant(
  scope: TenantScope,
  id: string,
): Promise<void> {
  return disconnectGoogleIntegration(scope, id);
}


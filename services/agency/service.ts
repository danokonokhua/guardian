import "server-only";

import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import {
  assertCanUseAgencyBranding,
  assertCanUseBulkScans,
  assertCanUseMultiClientDashboard,
} from "@/lib/billing/entitlements";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { runBulkPortfolioScan } from "./bulk-scanner";
import {
  createAgencyClient,
  deleteAgencyClient,
  findAgencyClientByDomain,
  findAgencyClientById,
  getAgencyBranding,
  listAgencyClients,
  updateAgencyClient,
  updateAgencyClientScore,
  upsertAgencyBranding,
} from "./repository";
import { aggregateAgencyPortfolio } from "./summary";
import type {
  AgencyBrandingRecord,
  AgencyClientRecord,
  AgencyPortfolioOverview,
  BulkScanSummary,
} from "./types";

export function normalizeClientDomain(input: string): string {
  let trimmed = input.trim().toLowerCase();
  if (!trimmed) throw new ValidationError("Client domain is required");
  if (!/^https?:\/\//i.test(trimmed)) trimmed = `https://${trimmed}`;
  try {
    const parsed = new URL(trimmed);
    const domain = parsed.hostname.toLowerCase();
    if (!domain || !domain.includes(".")) {
      throw new ValidationError("Invalid domain format (e.g. client.com)");
    }
    return domain;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Invalid client domain format");
  }
}

export interface RegisterClientInput {
  clientName: string;
  clientDomain: string;
  contactEmail?: string | null;
  contactName?: string | null;
  monthlyRetainerCents?: number | null;
  notes?: string | null;
  planId?: string;
}

export async function registerAgencyClient(
  scope: TenantScope,
  input: RegisterClientInput,
): Promise<AgencyClientRecord> {
  // 1. Verify plan entitlement
  if (input.planId) {
    assertCanUseMultiClientDashboard(input.planId);
  } else {
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      }),
    );
    if (org?.plan) {
      assertCanUseMultiClientDashboard(org.plan);
    }
  }

  if (!input.clientName || input.clientName.trim().length === 0) {
    throw new ValidationError("Client name is required");
  }

  const domain = normalizeClientDomain(input.clientDomain);

  // 2. Prevent duplicate client domains within this agency
  const existing = await findAgencyClientByDomain(scope, domain);
  if (existing) {
    throw new ConflictError(`Client domain "${domain}" is already monitored in your agency`);
  }

  return createAgencyClient(scope, {
    clientName: input.clientName.trim(),
    clientDomain: domain,
    contactEmail: input.contactEmail?.trim() || null,
    contactName: input.contactName?.trim() || null,
    monthlyRetainerCents: input.monthlyRetainerCents ?? 0,
    notes: input.notes?.trim() || null,
  });
}

export async function bulkScanPortfolio(
  scope: TenantScope,
  options: { planId?: string } = {},
): Promise<BulkScanSummary> {
  // 1. Check entitlement
  if (options.planId) {
    assertCanUseBulkScans(options.planId);
  } else {
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      }),
    );
    if (org?.plan) {
      assertCanUseBulkScans(org.plan);
    }
  }

  const clients = await listAgencyClients(scope);
  const activeClients = clients.filter((c) => c.status === "ACTIVE");

  const summary = await runBulkPortfolioScan(activeClients);

  // Persist updated scores in database
  const now = new Date();
  for (const result of summary.clientResults) {
    if (result.status === "OK") {
      await updateAgencyClientScore(scope, result.clientId, result.newScore, now);
    }
  }

  return summary;
}

export async function getPortfolioOverview(scope: TenantScope): Promise<AgencyPortfolioOverview> {
  const [clients, branding] = await Promise.all([
    listAgencyClients(scope),
    getAgencyBranding(scope),
  ]);

  return aggregateAgencyPortfolio(clients, branding);
}

export async function updateAgencyClientDetails(
  scope: TenantScope,
  clientId: string,
  data: {
    clientName?: string;
    contactEmail?: string | null;
    contactName?: string | null;
    status?: string;
    monthlyRetainerCents?: number | null;
    notes?: string | null;
  },
): Promise<AgencyClientRecord> {
  const client = await findAgencyClientById(scope, clientId);
  if (!client) {
    throw new NotFoundError(`Client ${clientId} not found`);
  }

  return updateAgencyClient(scope, clientId, {
    clientName: data.clientName?.trim(),
    contactEmail: data.contactEmail?.trim() || null,
    contactName: data.contactName?.trim() || null,
    status: data.status,
    monthlyRetainerCents: data.monthlyRetainerCents,
    notes: data.notes?.trim() || null,
  });
}

export async function removeAgencyClient(scope: TenantScope, clientId: string): Promise<boolean> {
  const client = await findAgencyClientById(scope, clientId);
  if (!client) {
    throw new NotFoundError(`Client ${clientId} not found`);
  }

  return deleteAgencyClient(scope, clientId);
}

export interface SaveBrandingInput {
  companyName: string;
  logoUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
  customDomain?: string | null;
  portalTitle?: string | null;
  supportEmail?: string | null;
  footerText?: string | null;
  isWhiteLabelActive?: boolean;
  planId?: string;
}

export async function saveAgencyBranding(
  scope: TenantScope,
  input: SaveBrandingInput,
): Promise<AgencyBrandingRecord> {
  // 1. Verify plan entitlement
  if (input.planId) {
    assertCanUseAgencyBranding(input.planId);
  } else {
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      }),
    );
    if (org?.plan) {
      assertCanUseAgencyBranding(org.plan);
    }
  }

  if (!input.companyName || input.companyName.trim().length === 0) {
    throw new ValidationError("Agency company name is required");
  }

  return upsertAgencyBranding(scope, {
    companyName: input.companyName.trim(),
    logoUrl: input.logoUrl?.trim() || null,
    brandPrimaryColor: input.brandPrimaryColor?.trim() || "#06b6d4",
    brandAccentColor: input.brandAccentColor?.trim() || "#8b5cf6",
    customDomain: input.customDomain?.trim() || null,
    portalTitle: input.portalTitle?.trim() || null,
    supportEmail: input.supportEmail?.trim() || null,
    footerText: input.footerText?.trim() || null,
    isWhiteLabelActive: input.isWhiteLabelActive ?? true,
  });
}

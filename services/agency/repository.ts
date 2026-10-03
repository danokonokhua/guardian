import "server-only";

import type { Prisma } from "@prisma/client";
import type { TenantScope } from "@/db/tenant";
import { withTenantTransaction } from "@/db/tenant";
import type { AgencyBrandingRecord, AgencyClientRecord } from "./types";

const clientSelect = {
  id: true,
  agencyOrganizationId: true,
  clientOrganizationId: true,
  clientName: true,
  clientDomain: true,
  contactEmail: true,
  contactName: true,
  status: true,
  notes: true,
  monthlyRetainerCents: true,
  currency: true,
  healthScore: true,
  lastScannedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const brandingSelect = {
  id: true,
  organizationId: true,
  companyName: true,
  logoUrl: true,
  brandPrimaryColor: true,
  brandAccentColor: true,
  customDomain: true,
  portalTitle: true,
  supportEmail: true,
  footerText: true,
  isWhiteLabelActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listAgencyClients(
  scope: TenantScope,
): Promise<AgencyClientRecord[]> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyClient.findMany({
      where: { agencyOrganizationId: scope.organizationId },
      select: clientSelect,
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function findAgencyClientById(
  scope: TenantScope,
  id: string,
): Promise<AgencyClientRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyClient.findFirst({
      where: { id, agencyOrganizationId: scope.organizationId },
      select: clientSelect,
    }),
  );
}

export async function findAgencyClientByDomain(
  scope: TenantScope,
  clientDomain: string,
): Promise<AgencyClientRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyClient.findFirst({
      where: {
        agencyOrganizationId: scope.organizationId,
        clientDomain: clientDomain.toLowerCase(),
      },
      select: clientSelect,
    }),
  );
}

export async function createAgencyClient(
  scope: TenantScope,
  data: {
    clientName: string;
    clientDomain: string;
    contactEmail?: string | null;
    contactName?: string | null;
    monthlyRetainerCents?: number | null;
    notes?: string | null;
  },
): Promise<AgencyClientRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyClient.create({
      data: {
        agencyOrganizationId: scope.organizationId,
        clientName: data.clientName,
        clientDomain: data.clientDomain.toLowerCase(),
        contactEmail: data.contactEmail ?? null,
        contactName: data.contactName ?? null,
        monthlyRetainerCents: data.monthlyRetainerCents ?? 0,
        notes: data.notes ?? null,
        status: "ACTIVE",
        healthScore: 85,
        currency: "USD",
      },
      select: clientSelect,
    }),
  );
}

export async function updateAgencyClient(
  scope: TenantScope,
  id: string,
  data: {
    clientName?: string;
    contactEmail?: string | null;
    contactName?: string | null;
    status?: string;
    monthlyRetainerCents?: number | null;
    notes?: string | null;
  },
): Promise<AgencyClientRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyClient.update({
      where: { id, agencyOrganizationId: scope.organizationId },
      data,
      select: clientSelect,
    }),
  );
}

export async function updateAgencyClientScore(
  scope: TenantScope,
  id: string,
  healthScore: number,
  lastScannedAt: Date,
): Promise<AgencyClientRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyClient.update({
      where: { id, agencyOrganizationId: scope.organizationId },
      data: { healthScore, lastScannedAt },
      select: clientSelect,
    }),
  );
}

export async function deleteAgencyClient(
  scope: TenantScope,
  id: string,
): Promise<boolean> {
  return withTenantTransaction(scope, async (tx) => {
    const deleted = await tx.agencyClient.deleteMany({
      where: { id, agencyOrganizationId: scope.organizationId },
    });
    return deleted.count > 0;
  });
}

export async function getAgencyBranding(
  scope: TenantScope,
): Promise<AgencyBrandingRecord | null> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyBranding.findUnique({
      where: { organizationId: scope.organizationId },
      select: brandingSelect,
    }),
  );
}

export async function upsertAgencyBranding(
  scope: TenantScope,
  data: {
    companyName: string;
    logoUrl?: string | null;
    brandPrimaryColor?: string | null;
    brandAccentColor?: string | null;
    customDomain?: string | null;
    portalTitle?: string | null;
    supportEmail?: string | null;
    footerText?: string | null;
    isWhiteLabelActive?: boolean;
  },
): Promise<AgencyBrandingRecord> {
  return withTenantTransaction(scope, async (tx) =>
    tx.agencyBranding.upsert({
      where: { organizationId: scope.organizationId },
      create: {
        organizationId: scope.organizationId,
        companyName: data.companyName,
        logoUrl: data.logoUrl ?? null,
        brandPrimaryColor: data.brandPrimaryColor ?? "#06b6d4",
        brandAccentColor: data.brandAccentColor ?? "#8b5cf6",
        customDomain: data.customDomain ?? null,
        portalTitle: data.portalTitle ?? null,
        supportEmail: data.supportEmail ?? null,
        footerText: data.footerText ?? null,
        isWhiteLabelActive: data.isWhiteLabelActive ?? true,
      },
      update: {
        companyName: data.companyName,
        logoUrl: data.logoUrl,
        brandPrimaryColor: data.brandPrimaryColor,
        brandAccentColor: data.brandAccentColor,
        customDomain: data.customDomain,
        portalTitle: data.portalTitle,
        supportEmail: data.supportEmail,
        footerText: data.footerText,
        isWhiteLabelActive: data.isWhiteLabelActive,
      },
      select: brandingSelect,
    }),
  );
}


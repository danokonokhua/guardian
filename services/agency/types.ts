export type ClientRiskLevel = "HEALTHY" | "DEGRADED" | "AT_RISK";

export interface AgencyClientRecord {
  id: string;
  agencyOrganizationId: string;
  clientOrganizationId: string | null;
  clientName: string;
  clientDomain: string;
  contactEmail: string | null;
  contactName: string | null;
  status: string; // ACTIVE, PAUSED, ARCHIVED
  notes: string | null;
  monthlyRetainerCents: number | null;
  currency: string;
  healthScore: number | null;
  lastScannedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgencyBrandingRecord {
  id: string;
  organizationId: string;
  companyName: string;
  logoUrl: string | null;
  brandPrimaryColor: string | null;
  brandAccentColor: string | null;
  customDomain: string | null;
  portalTitle: string | null;
  supportEmail: string | null;
  footerText: string | null;
  isWhiteLabelActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClientListItem {
  id: string;
  clientName: string;
  clientDomain: string;
  contactEmail: string | null;
  contactName: string | null;
  status: string;
  monthlyRetainerCents: number;
  healthScore: number;
  riskLevel: ClientRiskLevel;
  lastScannedAt: Date | null;
  notes: string | null;
}

export interface AgencyPortfolioOverview {
  totalClients: number;
  activeClients: number;
  totalMonthlyRetainerCents: number;
  averageHealthScore: number;
  healthyCount: number;
  degradedCount: number;
  atRiskCount: number;
  clients: ClientListItem[];
  branding: AgencyBrandingRecord | null;
}

export interface BulkScanClientResult {
  clientId: string;
  clientName: string;
  domain: string;
  previousScore: number;
  newScore: number;
  status: "OK" | "FAILED";
}

export interface BulkScanSummary {
  scannedCount: number;
  successCount: number;
  failedCount: number;
  durationMs: number;
  clientResults: BulkScanClientResult[];
}


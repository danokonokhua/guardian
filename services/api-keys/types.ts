export const ALL_API_SCOPES = [
  "*",
  "health:read",
  "issues:read",
  "issues:write",
  "monitors:read",
  "monitors:write",
  "remediation:read",
  "remediation:write",
  "agency:read",
  "agency:write",
  "reports:read",
] as const;

export type ApiKeyScope = (typeof ALL_API_SCOPES)[number];

export interface CreateApiKeyInput {
  name: string;
  scopes?: string[];
  expiresInDays?: number | null;
  createdById?: string | null;
}

export interface ApiKeySummary {
  id: string;
  organizationId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  rateLimitPerMinute: number;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  isActive: boolean;
}

export interface GeneratedApiKey {
  rawToken: string;
  key: ApiKeySummary;
}

export interface ApiKeyAuthResult {
  authenticated: boolean;
  organizationId?: string;
  apiKeyId?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  error?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

export interface ApiKeyOverview {
  activeCount: number;
  revokedCount: number;
  rateLimitTier: number;
  lastUsedAt: Date | null;
  keys: ApiKeySummary[];
}


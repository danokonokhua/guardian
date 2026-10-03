import "server-only";

import type { TenantScope } from "@/db/tenant";
import { assertCanUseApiAccess, getPlanRateLimitPerMinute } from "@/lib/billing/entitlements";
import { generateRawApiKey, hashApiKey } from "./crypto";
import { checkApiKeyRateLimit } from "./rate-limiter";
import {
  createApiKeyRecord,
  findApiKeyByHashGlobal,
  listApiKeysByOrg,
  revokeApiKeyRecord,
  updateApiKeyLastUsedGlobal,
  type ApiKeyPublicRecord,
} from "./repository";
import {
  ALL_API_SCOPES,
  type ApiKeyAuthResult,
  type ApiKeyOverview,
  type ApiKeySummary,
  type CreateApiKeyInput,
  type GeneratedApiKey,
} from "./types";

function formatSummary(record: ApiKeyPublicRecord): ApiKeySummary {
  const isExpired = record.expiresAt ? record.expiresAt.getTime() < Date.now() : false;
  const isRevoked = Boolean(record.revokedAt);
  const isActive = !isRevoked && !isExpired;

  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    keyPrefix: record.keyPrefix,
    scopes: record.scopes,
    rateLimitPerMinute: record.rateLimitPerMinute,
    lastUsedAt: record.lastUsedAt,
    expiresAt: record.expiresAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
    isActive,
  };
}

/**
 * Creates a new API key for the organization.
 * Generates a random cryptographic token, computes its SHA-256 hash, and saves metadata.
 * The raw token is returned ONCE and cannot be recovered later.
 */
export async function createApiKey(
  scope: TenantScope,
  input: CreateApiKeyInput,
  planId?: string
): Promise<GeneratedApiKey> {
  let effectivePlan = planId;
  if (!effectivePlan) {
    const { withTenantTransaction } = await import("@/db/tenant");
    const org = await withTenantTransaction(scope, async (tx) =>
      tx.organization.findUnique({
        where: { id: scope.organizationId },
        select: { plan: true },
      })
    );
    effectivePlan = org?.plan ?? "PRO";
  }

  // Enforce plan entitlement: PRO, AGENCY, WHITE_LABEL, ENTERPRISE
  assertCanUseApiAccess(effectivePlan);

  const rateLimitPerMinute = getPlanRateLimitPerMinute(effectivePlan);
  const { rawToken, keyPrefix } = generateRawApiKey("live");
  const keyHash = hashApiKey(rawToken);

  let expiresAt: Date | null = null;
  if (input.expiresInDays && input.expiresInDays > 0) {
    expiresAt = new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000);
  }

  // Sanitize scopes
  let scopes = ["*"];
  if (input.scopes && input.scopes.length > 0) {
    scopes = input.scopes.filter((s) => ALL_API_SCOPES.includes(s as any));
    if (scopes.length === 0) scopes = ["*"];
  }

  const record = await createApiKeyRecord(scope, {
    name: input.name.trim() || "Default API Key",
    keyPrefix,
    keyHash,
    scopes,
    rateLimitPerMinute,
    expiresAt,
    createdById: input.createdById ?? null,
  });

  return {
    rawToken,
    key: formatSummary(record),
  };
}

/**
 * Lists all API keys for the current organization.
 */
export async function listApiKeys(scope: TenantScope): Promise<ApiKeySummary[]> {
  const records = await listApiKeysByOrg(scope);
  return records.map(formatSummary);
}

/**
 * Revokes an existing API key.
 */
export async function revokeApiKey(
  scope: TenantScope,
  id: string
): Promise<ApiKeySummary | null> {
  const record = await revokeApiKeyRecord(scope, id);
  return record ? formatSummary(record) : null;
}

/**
 * Authenticates an inbound API request using raw Bearer or X-API-Key token.
 * Performs hash resolution, revocation checks, expiration checks, scope validation, and rate limiting.
 */
export async function authenticateApiKeyToken(
  rawToken: string,
  requiredScope?: string
): Promise<ApiKeyAuthResult> {
  const token = rawToken.trim();
  if (!token.startsWith("gdn_")) {
    return { authenticated: false, error: "Invalid API key format" };
  }

  const keyHash = hashApiKey(token);
  const record = await findApiKeyByHashGlobal(keyHash);

  if (!record) {
    return { authenticated: false, error: "Invalid API key" };
  }

  if (record.revokedAt) {
    return { authenticated: false, error: "API key has been revoked" };
  }

  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    return { authenticated: false, error: "API key has expired" };
  }

  // Validate granted scopes
  if (requiredScope) {
    const hasWildcard = record.scopes.includes("*");
    const hasExplicit = record.scopes.includes(requiredScope);
    if (!hasWildcard && !hasExplicit) {
      return {
        authenticated: false,
        error: `Insufficient scope: requires '${requiredScope}'`,
      };
    }
  }

  // Check rate limit
  const rateLimit = checkApiKeyRateLimit(record.id, record.rateLimitPerMinute);
  if (!rateLimit.allowed) {
    return {
      authenticated: false,
      error: "API rate limit exceeded. Please retry in a few seconds.",
      rateLimitPerMinute: record.rateLimitPerMinute,
    };
  }

  // Update last used timestamp in the background
  void updateApiKeyLastUsedGlobal(record.id);

  return {
    authenticated: true,
    organizationId: record.organizationId,
    apiKeyId: record.id,
    scopes: record.scopes,
    rateLimitPerMinute: record.rateLimitPerMinute,
  };
}

/**
 * Gathers developer overview statistics for the organization.
 */
export async function getApiKeyOverview(
  scope: TenantScope,
  planId: string = "PRO"
): Promise<ApiKeyOverview> {
  const keys = await listApiKeys(scope);
  const activeCount = keys.filter((k) => k.isActive).length;
  const revokedCount = keys.filter((k) => !k.isActive).length;
  const rateLimitTier = getPlanRateLimitPerMinute(planId);

  let lastUsedAt: Date | null = null;
  for (const k of keys) {
    if (k.lastUsedAt && (!lastUsedAt || k.lastUsedAt > lastUsedAt)) {
      lastUsedAt = k.lastUsedAt;
    }
  }

  return {
    activeCount,
    revokedCount,
    rateLimitTier,
    lastUsedAt,
    keys,
  };
}

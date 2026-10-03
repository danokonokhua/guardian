import { describe, expect, it, vi } from "vitest";
import {
  assertCanUseApiAccess,
  getPlanRateLimitPerMinute,
} from "@/lib/billing/entitlements";
import { ForbiddenError } from "@/lib/errors";
import {
  authenticateApiKeyToken,
  createApiKey,
  getApiKeyOverview,
  listApiKeys,
  revokeApiKey,
} from "@/services/api-keys/service";
import * as repository from "@/services/api-keys/repository";

vi.mock("@/services/api-keys/repository");

const mockTenantScope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "user-test-1",
  role: "ADMIN" as const,
};

describe("API Key Service & Plan Gating (PRD §19 & §20)", () => {
  it("enforces plan entitlements: blocks FREE/STARTER/GROWTH, allows PRO/AGENCY/ENTERPRISE", () => {
    expect(() => assertCanUseApiAccess("FREE")).toThrow(ForbiddenError);
    expect(() => assertCanUseApiAccess("STARTER")).toThrow(ForbiddenError);
    expect(() => assertCanUseApiAccess("GROWTH")).toThrow(ForbiddenError);

    expect(() => assertCanUseApiAccess("PRO")).not.toThrow();
    expect(() => assertCanUseApiAccess("AGENCY")).not.toThrow();
    expect(() => assertCanUseApiAccess("WHITE_LABEL")).not.toThrow();
    expect(() => assertCanUseApiAccess("ENTERPRISE")).not.toThrow();
  });

  it("resolves tiered rate limits based on organization plan", () => {
    expect(getPlanRateLimitPerMinute("PRO")).toBe(60);
    expect(getPlanRateLimitPerMinute("AGENCY")).toBe(120);
    expect(getPlanRateLimitPerMinute("WHITE_LABEL")).toBe(300);
    expect(getPlanRateLimitPerMinute("ENTERPRISE")).toBe(1000);
  });

  it("creates an API key, generates high-entropy token, and stores hash", async () => {
    const mockCreated: repository.ApiKeyPublicRecord = {
      id: "key-123",
      organizationId: mockTenantScope.organizationId,
      name: "CI/CD Pipeline",
      keyPrefix: "gdn_live_12345",
      scopes: ["*"],
      rateLimitPerMinute: 120,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdById: mockTenantScope.userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(repository, "createApiKeyRecord").mockResolvedValue(mockCreated);

    const result = await createApiKey(
      mockTenantScope,
      { name: "CI/CD Pipeline", scopes: ["*"] },
      "AGENCY"
    );

    expect(result.rawToken.startsWith("gdn_live_")).toBe(true);
    expect(result.key.name).toBe("CI/CD Pipeline");
    expect(result.key.rateLimitPerMinute).toBe(120);
    expect(result.key.isActive).toBe(true);
    expect(repository.createApiKeyRecord).toHaveBeenCalledWith(
      mockTenantScope,
      expect.objectContaining({
        name: "CI/CD Pipeline",
        scopes: ["*"],
        rateLimitPerMinute: 120,
      })
    );
  });

  it("authenticates inbound tokens, enforces scopes and revocation", async () => {
    const validToken = "gdn_live_abcdef1234567890abcdef1234567890";
    const { hashApiKey } = await import("@/services/api-keys/crypto");
    const validHash = hashApiKey(validToken);

    // 1. Unknown token
    vi.spyOn(repository, "findApiKeyByHashGlobal").mockResolvedValue(null);
    const unknownRes = await authenticateApiKeyToken(validToken);
    expect(unknownRes.authenticated).toBe(false);
    expect(unknownRes.error).toBe("Invalid API key");

    // 2. Revoked token
    vi.spyOn(repository, "findApiKeyByHashGlobal").mockResolvedValue({
      id: "key-revoked",
      organizationId: mockTenantScope.organizationId,
      name: "Revoked Key",
      keyPrefix: "gdn_live_abc",
      keyHash: validHash,
      scopes: ["*"],
      rateLimitPerMinute: 60,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: new Date(),
      createdById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const revokedRes = await authenticateApiKeyToken(validToken);
    expect(revokedRes.authenticated).toBe(false);
    expect(revokedRes.error).toBe("API key has been revoked");

    // 3. Expired token
    vi.spyOn(repository, "findApiKeyByHashGlobal").mockResolvedValue({
      id: "key-expired",
      organizationId: mockTenantScope.organizationId,
      name: "Expired Key",
      keyPrefix: "gdn_live_abc",
      keyHash: validHash,
      scopes: ["*"],
      rateLimitPerMinute: 60,
      lastUsedAt: null,
      expiresAt: new Date(Date.now() - 10000), // in the past
      revokedAt: null,
      createdById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const expiredRes = await authenticateApiKeyToken(validToken);
    expect(expiredRes.authenticated).toBe(false);
    expect(expiredRes.error).toBe("API key has expired");

    // 4. Insufficient scope
    vi.spyOn(repository, "findApiKeyByHashGlobal").mockResolvedValue({
      id: "key-read-only",
      organizationId: mockTenantScope.organizationId,
      name: "Read Only",
      keyPrefix: "gdn_live_abc",
      keyHash: validHash,
      scopes: ["health:read"],
      rateLimitPerMinute: 60,
      lastUsedAt: null,
      expiresAt: null,
      revokedAt: null,
      createdById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const scopeRes = await authenticateApiKeyToken(validToken, "issues:write");
    expect(scopeRes.authenticated).toBe(false);
    expect(scopeRes.error).toContain("Insufficient scope");

    // 5. Valid authentication
    vi.spyOn(repository, "updateApiKeyLastUsedGlobal").mockResolvedValue(undefined);
    const validRes = await authenticateApiKeyToken(validToken, "health:read");
    expect(validRes.authenticated).toBe(true);
    expect(validRes.organizationId).toBe(mockTenantScope.organizationId);
  });

  it("lists keys and compiles developer overview", async () => {
    vi.spyOn(repository, "listApiKeysByOrg").mockResolvedValue([
      {
        id: "key-1",
        organizationId: mockTenantScope.organizationId,
        name: "Key 1",
        keyPrefix: "gdn_live_111",
        scopes: ["*"],
        rateLimitPerMinute: 120,
        lastUsedAt: new Date("2026-10-01T12:00:00Z"),
        expiresAt: null,
        revokedAt: null,
        createdById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "key-2",
        organizationId: mockTenantScope.organizationId,
        name: "Key 2",
        keyPrefix: "gdn_live_222",
        scopes: ["health:read"],
        rateLimitPerMinute: 120,
        lastUsedAt: null,
        expiresAt: null,
        revokedAt: new Date(),
        createdById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const overview = await getApiKeyOverview(mockTenantScope, "AGENCY");
    expect(overview.activeCount).toBe(1);
    expect(overview.revokedCount).toBe(1);
    expect(overview.rateLimitTier).toBe(120);
    expect(overview.keys).toHaveLength(2);
  });
});

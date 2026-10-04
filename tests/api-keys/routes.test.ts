import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, roleMock, apiKeyServiceMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  roleMock: vi.fn(),
  apiKeyServiceMock: {
    getApiKeyOverview: vi.fn(),
    createApiKey: vi.fn(),
    revokeApiKey: vi.fn(),
    listApiKeys: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requirePermission: permissionMock,
  requireRole: roleMock,
}));

vi.mock("@/services/api-keys/service", () => apiKeyServiceMock);

import { GET as getOpenApiRoute } from "@/app/api/v1/openapi.json/route";
import {
  GET as getApiKeysRoute,
  POST as postApiKeyRoute,
} from "@/app/api/v1/organizations/[organizationId]/api-keys/route";
import { DELETE as deleteApiKeyRoute } from "@/app/api/v1/organizations/[organizationId]/api-keys/[keyId]/route";

const ORG = "org-test-123";
const KEY_ID = "key-test-456";

const authContext = {
  organizationId: ORG,
  user: { userId: "user-admin", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "ADMIN" },
};

describe("API Platform Routes (PRD §19 & §23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(authContext);
    roleMock.mockResolvedValue(authContext);
  });

  describe("GET /api/v1/openapi.json", () => {
    it("returns OpenAPI 3.0 specification", async () => {
      const response = await getOpenApiRoute();
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.openapi).toBe("3.0.3");
      expect(json.info.title).toContain("Guardian");
      expect(json.paths["/organizations/{organizationId}/health"]).toBeDefined();
      expect(json.paths["/organizations/{organizationId}/api-keys"]).toBeDefined();
    });
  });

  describe("GET /api/v1/organizations/[orgId]/api-keys", () => {
    it("returns developer overview and API keys", async () => {
      apiKeyServiceMock.getApiKeyOverview.mockResolvedValue({
        activeCount: 1,
        revokedCount: 0,
        rateLimitTier: 120,
        lastUsedAt: null,
        keys: [
          {
            id: KEY_ID,
            name: "Production Token",
            keyPrefix: "gdn_live_12345",
            scopes: ["*"],
            rateLimitPerMinute: 120,
            isActive: true,
          },
        ],
      });

      const response = await getApiKeysRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/api-keys`),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.activeCount).toBe(1);
      expect(json.data.rateLimitTier).toBe(120);
      expect(json.data.keys[0].name).toBe("Production Token");
      expect(permissionMock).toHaveBeenCalledWith(ORG, "org:read");
    });
  });

  describe("POST /api/v1/organizations/[orgId]/api-keys", () => {
    it("creates a new API key and returns raw token once", async () => {
      apiKeyServiceMock.createApiKey.mockResolvedValue({
        rawToken: "gdn_live_abcdef1234567890abcdef1234567890",
        key: {
          id: KEY_ID,
          name: "Staging Token",
          keyPrefix: "gdn_live_abc",
          scopes: ["*"],
          rateLimitPerMinute: 60,
          isActive: true,
        },
      });

      const response = await postApiKeyRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/api-keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Staging Token", scopes: ["*"] }),
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.rawToken).toBe("gdn_live_abcdef1234567890abcdef1234567890");
      expect(json.data.key.name).toBe("Staging Token");
      expect(roleMock).toHaveBeenCalledWith(ORG, "ADMIN");
    });

    it("rejects empty name with validation error", async () => {
      const response = await postApiKeyRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/api-keys`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "" }),
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/organizations/[orgId]/api-keys/[keyId]", () => {
    it("revokes an API key successfully", async () => {
      apiKeyServiceMock.revokeApiKey.mockResolvedValue({
        id: KEY_ID,
        name: "Old Token",
        isActive: false,
        revokedAt: new Date(),
      });

      const response = await deleteApiKeyRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/api-keys/${KEY_ID}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ organizationId: ORG, keyId: KEY_ID }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.isActive).toBe(false);
      expect(roleMock).toHaveBeenCalledWith(ORG, "ADMIN");
    });

    it("returns 404 when key is not found", async () => {
      apiKeyServiceMock.revokeApiKey.mockResolvedValue(null);

      const response = await deleteApiKeyRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/api-keys/${KEY_ID}`, {
          method: "DELETE",
        }),
        { params: Promise.resolve({ organizationId: ORG, keyId: KEY_ID }) },
      );

      expect(response.status).toBe(404);
    });
  });
});

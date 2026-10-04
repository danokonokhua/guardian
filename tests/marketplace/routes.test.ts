import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, roleMock, marketplaceServiceMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  roleMock: vi.fn(),
  marketplaceServiceMock: {
    getMarketplaceCatalog: vi.fn(),
    installMarketplacePlugin: vi.fn(),
    setPluginStatus: vi.fn(),
    uninstallMarketplacePlugin: vi.fn(),
    testMarketplacePlugin: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requirePermission: permissionMock,
  requireRole: roleMock,
}));

vi.mock("@/services/marketplace/service", () => marketplaceServiceMock);

import {
  GET as getCatalogRoute,
  POST as installPluginRoute,
} from "@/app/api/v1/organizations/[organizationId]/marketplace/route";
import {
  PATCH as patchStatusRoute,
  DELETE as deletePluginRoute,
} from "@/app/api/v1/organizations/[organizationId]/marketplace/[pluginId]/route";
import { POST as testPluginRoute } from "@/app/api/v1/organizations/[organizationId]/marketplace/[pluginId]/test/route";

const ORG = "org-mkt-123";
const authContext = {
  organizationId: ORG,
  user: { userId: "user-admin", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "ADMIN" },
  organization: { id: ORG, plan: "PRO" },
};

describe("Marketplace Platform REST API Routes (PRD §20, §21, §23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(authContext);
    roleMock.mockResolvedValue(authContext);
  });

  describe("GET /api/v1/organizations/[organizationId]/marketplace", () => {
    it("returns catalog and installation metrics for the organization", async () => {
      marketplaceServiceMock.getMarketplaceCatalog.mockResolvedValue({
        catalogCount: 8,
        installedCount: 2,
        activeCount: 2,
        plugins: [],
      });

      const response = await getCatalogRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/marketplace`),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.catalogCount).toBe(8);
      expect(json.data.installedCount).toBe(2);
      expect(permissionMock).toHaveBeenCalledWith(ORG, "org:read");
    });
  });

  describe("POST /api/v1/organizations/[organizationId]/marketplace", () => {
    it("installs a plugin with validated payload and ADMIN role requirement", async () => {
      marketplaceServiceMock.installMarketplacePlugin.mockResolvedValue({
        id: "inst-1",
        pluginId: "slack-notifications",
        status: "ACTIVE",
      });

      const payload = {
        pluginId: "slack-notifications",
        config: { channel: "#alerts" },
        credentials: { webhookUrl: "https://hooks.slack.com/services/123" },
      };

      const response = await installPluginRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/marketplace`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.id).toBe("inst-1");
      expect(roleMock).toHaveBeenCalledWith(ORG, "ADMIN");
    });

    it("rejects invalid requests missing pluginId", async () => {
      const response = await installPluginRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/marketplace`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config: {} }),
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/organizations/[organizationId]/marketplace/[pluginId]", () => {
    it("updates plugin status to PAUSED or ACTIVE", async () => {
      marketplaceServiceMock.setPluginStatus.mockResolvedValue({
        id: "inst-1",
        pluginId: "slack-notifications",
        status: "PAUSED",
      });

      const response = await patchStatusRoute(
        new Request(
          `https://guardian.test/api/v1/organizations/${ORG}/marketplace/slack-notifications`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "PAUSED" }),
          },
        ),
        {
          params: Promise.resolve({
            organizationId: ORG,
            pluginId: "slack-notifications",
          }),
        },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.status).toBe("PAUSED");
      expect(marketplaceServiceMock.setPluginStatus).toHaveBeenCalledWith(
        expect.anything(),
        "slack-notifications",
        "PAUSED",
      );
    });
  });

  describe("DELETE /api/v1/organizations/[organizationId]/marketplace/[pluginId]", () => {
    it("uninstalls a plugin from the organization", async () => {
      marketplaceServiceMock.uninstallMarketplacePlugin.mockResolvedValue(undefined);

      const response = await deletePluginRoute(
        new Request(
          `https://guardian.test/api/v1/organizations/${ORG}/marketplace/slack-notifications`,
          { method: "DELETE" },
        ),
        {
          params: Promise.resolve({
            organizationId: ORG,
            pluginId: "slack-notifications",
          }),
        },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.uninstalled).toBe(true);
      expect(marketplaceServiceMock.uninstallMarketplacePlugin).toHaveBeenCalledWith(
        expect.anything(),
        "slack-notifications",
      );
    });
  });

  describe("POST /api/v1/organizations/[organizationId]/marketplace/[pluginId]/test", () => {
    it("fires diagnostic verification signal", async () => {
      marketplaceServiceMock.testMarketplacePlugin.mockResolvedValue({
        success: true,
        message: "Test signal delivered successfully to Slack Smart Incident Bot.",
      });

      const response = await testPluginRoute(
        new Request(
          `https://guardian.test/api/v1/organizations/${ORG}/marketplace/slack-notifications/test`,
          { method: "POST" },
        ),
        {
          params: Promise.resolve({
            organizationId: ORG,
            pluginId: "slack-notifications",
          }),
        },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.success).toBe(true);
      expect(marketplaceServiceMock.testMarketplacePlugin).toHaveBeenCalledWith(
        expect.anything(),
        "slack-notifications",
      );
    });
  });
});

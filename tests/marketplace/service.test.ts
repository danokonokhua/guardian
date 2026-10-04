import { describe, expect, it, vi, beforeEach } from "vitest";
import { assertCanUseMarketplace } from "@/lib/billing/entitlements";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import {
  getMarketplaceCatalog,
  installMarketplacePlugin,
  setPluginStatus,
  uninstallMarketplacePlugin,
  testMarketplacePlugin,
} from "@/services/marketplace/service";
import * as repository from "@/services/marketplace/repository";

vi.mock("@/services/marketplace/repository");

const mockTenantScope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "user-test-1",
  role: "ADMIN" as const,
};

describe("Marketplace Service & Lifecycle (PRD §20, §21, §23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Plan Entitlement Gating", () => {
    it("blocks FREE and STARTER tiers from installing plugins", () => {
      expect(() => assertCanUseMarketplace("FREE")).toThrow(ForbiddenError);
      expect(() => assertCanUseMarketplace("STARTER")).toThrow(ForbiddenError);
    });

    it("allows GROWTH, PRO, AGENCY, WHITE_LABEL, and ENTERPRISE tiers", () => {
      expect(() => assertCanUseMarketplace("GROWTH")).not.toThrow();
      expect(() => assertCanUseMarketplace("PRO")).not.toThrow();
      expect(() => assertCanUseMarketplace("AGENCY")).not.toThrow();
      expect(() => assertCanUseMarketplace("WHITE_LABEL")).not.toThrow();
      expect(() => assertCanUseMarketplace("ENTERPRISE")).not.toThrow();
    });
  });

  describe("Catalog Listing", () => {
    it("decorates catalog with tenant installation status and calculates summary metrics", async () => {
      vi.spyOn(repository, "listMarketplaceInstallsByOrg").mockResolvedValue([
        {
          id: "inst-1",
          organizationId: mockTenantScope.organizationId,
          pluginId: "slack-notifications",
          status: "ACTIVE",
          config: { channel: "#incidents" },
          installedById: mockTenantScope.userId,
          lastSyncAt: new Date(),
          lastError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const overview = await getMarketplaceCatalog(mockTenantScope, "PRO");

      expect(overview.catalogCount).toBeGreaterThanOrEqual(8);
      expect(overview.installedCount).toBe(1);
      expect(overview.activeCount).toBe(1);

      const slack = overview.plugins.find((p) => p.plugin.id === "slack-notifications");
      expect(slack?.isInstalled).toBe(true);
      expect(slack?.status).toBe("ACTIVE");

      const teams = overview.plugins.find((p) => p.plugin.id === "ms-teams-connector");
      expect(teams?.isInstalled).toBe(false);
      expect(teams?.status).toBe("NOT_INSTALLED");
    });
  });

  describe("Plugin Installation", () => {
    it("rejects unknown plugins with NotFoundError", async () => {
      await expect(
        installMarketplacePlugin(
          mockTenantScope,
          { pluginId: "non-existent-plugin", config: {} },
          "PRO"
        )
      ).rejects.toThrow(NotFoundError);
    });

    it("enforces plugin-specific plan requirements (e.g. PagerDuty requires PRO+)", async () => {
      await expect(
        installMarketplacePlugin(
          mockTenantScope,
          {
            pluginId: "pagerduty-sync",
            config: {},
            credentials: { routingKey: "12345678" },
          },
          "GROWTH" // GROWTH is below PRO
        )
      ).rejects.toThrow(ConflictError);
    });

    it("validates missing required configuration fields", async () => {
      await expect(
        installMarketplacePlugin(
          mockTenantScope,
          {
            pluginId: "slack-notifications",
            config: {},
            credentials: {}, // missing webhookUrl
          },
          "PRO"
        )
      ).rejects.toThrow(ValidationError);
    });

    it("installs plugin successfully with encrypted credentials", async () => {
      const mockCreated = {
        id: "inst-slack",
        organizationId: mockTenantScope.organizationId,
        pluginId: "slack-notifications",
        status: "ACTIVE",
        config: { channel: "#alerts" },
        installedById: mockTenantScope.userId,
        lastSyncAt: new Date(),
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(repository, "upsertMarketplaceInstallRecord").mockResolvedValue(mockCreated);

      const result = await installMarketplacePlugin(
        mockTenantScope,
        {
          pluginId: "slack-notifications",
          config: { channel: "#alerts", minSeverity: "HIGH" },
          credentials: { webhookUrl: "https://hooks.slack.com/services/123" },
        },
        "PRO"
      );

      expect(result.id).toBe("inst-slack");
      expect(repository.upsertMarketplaceInstallRecord).toHaveBeenCalledWith(
        mockTenantScope,
        expect.objectContaining({
          pluginId: "slack-notifications",
          status: "ACTIVE",
          config: { channel: "#alerts", minSeverity: "HIGH" },
          encryptedCredentials: expect.stringMatching(/^v1\./),
        })
      );
    });
  });

  describe("Lifecycle & Testing", () => {
    it("updates plugin status (ACTIVE -> PAUSED)", async () => {
      vi.spyOn(repository, "findMarketplaceInstallByPluginId").mockResolvedValue({
        id: "inst-1",
        organizationId: mockTenantScope.organizationId,
        pluginId: "slack-notifications",
        status: "ACTIVE",
        config: {},
        encryptedCredentials: null,
        installedById: null,
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(repository, "updateMarketplaceInstallStatusRecord").mockResolvedValue({
        id: "inst-1",
        organizationId: mockTenantScope.organizationId,
        pluginId: "slack-notifications",
        status: "PAUSED",
        config: {},
        installedById: null,
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const updated = await setPluginStatus(mockTenantScope, "slack-notifications", "PAUSED");
      expect(updated.status).toBe("PAUSED");
      expect(repository.updateMarketplaceInstallStatusRecord).toHaveBeenCalledWith(
        mockTenantScope,
        "slack-notifications",
        "PAUSED",
        null
      );
    });

    it("uninstalls plugin", async () => {
      vi.spyOn(repository, "findMarketplaceInstallByPluginId").mockResolvedValue({
        id: "inst-1",
        organizationId: mockTenantScope.organizationId,
        pluginId: "slack-notifications",
        status: "ACTIVE",
        config: {},
        encryptedCredentials: null,
        installedById: null,
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(repository, "deleteMarketplaceInstallRecord").mockResolvedValue();

      await expect(
        uninstallMarketplacePlugin(mockTenantScope, "slack-notifications")
      ).resolves.toBeUndefined();
      expect(repository.deleteMarketplaceInstallRecord).toHaveBeenCalledWith(
        mockTenantScope,
        "slack-notifications"
      );
    });

    it("runs diagnostic test and dispatches simulated payload", async () => {
      const { encryptPluginCredentials } = await import("@/services/marketplace/crypto");
      const encrypted = encryptPluginCredentials(
        { webhookUrl: "https://hooks.slack.com/services/123" },
        `${mockTenantScope.organizationId}:slack-notifications`
      );

      vi.spyOn(repository, "findMarketplaceInstallByPluginId").mockResolvedValue({
        id: "inst-1",
        organizationId: mockTenantScope.organizationId,
        pluginId: "slack-notifications",
        status: "ACTIVE",
        config: { channel: "#test" },
        encryptedCredentials: encrypted,
        installedById: null,
        lastSyncAt: null,
        lastError: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(repository, "upsertMarketplaceInstallRecord").mockResolvedValue({} as any);

      const testResult = await testMarketplacePlugin(mockTenantScope, "slack-notifications");
      expect(testResult.success).toBe(true);
      expect(testResult.deliveredPayload?.credentialsConfigured).toBe(true);
    });
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import * as tenantDb from "@/db/tenant";
import * as wpRepo from "@/services/integrations/wordpress/repository";
import * as healthRepo from "@/services/health/repository";
import * as wpCollector from "@/services/integrations/wordpress/collector";
import * as issueEngine from "@/lib/issue-engine";
import {
  connectWordpressSite,
  syncWordpressSite,
  ingestWordpressWebhook,
  disconnectWordpressSite,
} from "@/services/integrations/wordpress/service";
import { NotFoundError, UnauthorizedError } from "@/lib/errors";
import { encryptWordpressToken } from "@/lib/integrations/wordpress/secrets";

describe("WordPress Service", () => {
  const scope: tenantDb.TenantScope = {
    organizationId: "org-1",
    userId: "user-1",
    role: "OWNER",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(healthRepo, "captureHealthScoreSnapshot").mockResolvedValue({} as any);
  });

  describe("connectWordpressSite", () => {
    it("connects a sandbox site with simulated telemetry and runs anomaly detection", async () => {
      const fakeWebsite = { id: "site-1", hostname: "myshop.example.com" };
      const fakeConnection = {
        id: "wp-conn-1",
        organizationId: "org-1",
        websiteId: "site-1",
        siteUrl: "https://myshop.example.com",
        tokenEncrypted: "v1.dummy",
        tokenPrefix: "gcon_sand_123456",
        status: "CONNECTED",
        isSandbox: true,
      };

      const mockTx = {
        website: {
          findFirst: vi.fn().mockResolvedValue(fakeWebsite),
        },
        wordpressConnection: {
          upsert: vi.fn().mockResolvedValue(fakeConnection),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      const detectSpy = vi
        .spyOn(wpCollector, "detectWordpressAnomalies")
        .mockResolvedValue({ detectedCount: 2, resolvedCount: 0, issueIds: ["iss-1"] });

      const result = await connectWordpressSite(scope, {
        websiteId: "site-1",
        isSandbox: true,
      });

      expect(result.connection).toEqual(fakeConnection);
      expect(result.token.startsWith("gcon_sand_")).toBe(true);
      expect(detectSpy).toHaveBeenCalled();
      expect(healthRepo.captureHealthScoreSnapshot).toHaveBeenCalledWith(scope);
    });

    it("connects a live site with live pairing token prefix without anomaly detection", async () => {
      const fakeWebsite = { id: "site-live", hostname: "gabofarms.com" };
      const fakeLiveConn = {
        id: "wp-conn-live",
        organizationId: "org-1",
        websiteId: "site-live",
        siteUrl: "https://gabofarms.com",
        tokenEncrypted: "v1.dummy",
        tokenPrefix: "gcon_live_123456",
        status: "CONNECTED",
        isSandbox: false,
      };

      const mockTx = {
        website: {
          findFirst: vi.fn().mockResolvedValue(fakeWebsite),
        },
        wordpressConnection: {
          upsert: vi.fn().mockResolvedValue(fakeLiveConn),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      const detectSpy = vi.spyOn(wpCollector, "detectWordpressAnomalies");

      const result = await connectWordpressSite(scope, {
        websiteId: "site-live",
        isSandbox: false,
      });

      expect(result.connection).toEqual(fakeLiveConn);
      expect(result.token.startsWith("gcon_live_")).toBe(true);
      expect(detectSpy).not.toHaveBeenCalled();
      expect(healthRepo.captureHealthScoreSnapshot).toHaveBeenCalledWith(scope);
    });

    it("throws NotFoundError if website is not found in organization", async () => {
      const mockTx = {
        website: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      await expect(
        connectWordpressSite(scope, { websiteId: "missing-site", isSandbox: true }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("syncWordpressSite", () => {
    it("handles sandbox simulation fix toggle and resolves issues", async () => {
      const fakeConnection = {
        id: "wp-conn-1",
        organizationId: "org-1",
        websiteId: "site-1",
        isSandbox: true,
      };

      vi.spyOn(wpRepo, "findWordpressConnection").mockResolvedValue(fakeConnection as any);

      const mockTx = {
        wordpressConnection: {
          update: vi.fn().mockResolvedValue({ ...fakeConnection, wpVersion: "6.7.1" }),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      const detectSpy = vi
        .spyOn(wpCollector, "detectWordpressAnomalies")
        .mockResolvedValue({ detectedCount: 0, resolvedCount: 3, issueIds: [] });

      const result = await syncWordpressSite(scope, "site-1", { simulateFix: true });

      expect(result.connection.wpVersion).toBe("6.7.1");
      expect(detectSpy).toHaveBeenCalledWith(
        expect.objectContaining({ wpVersion: "6.7.1", debugMode: false }),
        { organizationId: "org-1", websiteId: "site-1" },
        mockTx,
      );
      expect(healthRepo.captureHealthScoreSnapshot).toHaveBeenCalled();
    });

    it("throws NotFoundError if connection does not exist", async () => {
      vi.spyOn(wpRepo, "findWordpressConnection").mockResolvedValue(null);

      await expect(syncWordpressSite(scope, "non-existent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("ingestWordpressWebhook", () => {
    it("rejects invalid token prefixes or unknown connections", async () => {
      vi.spyOn(wpRepo, "findWordpressConnectionByPrefix").mockResolvedValue(null);

      await expect(
        ingestWordpressWebhook("gcon_live_unknown_12345678", { wpVersion: "6.7.1" }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("authenticates and ingests valid webhook telemetry payload", async () => {
      const realToken = "gcon_live_0123456789abcdef0123456789abcdef";
      const tokenPrefix = realToken.substring(0, 18);
      const context = "org-1:site-1";
      const tokenEncrypted = encryptWordpressToken(realToken, context);

      const fakeConnection = {
        id: "wp-1",
        organizationId: "org-1",
        websiteId: "site-1",
        tokenEncrypted,
        tokenPrefix,
      };

      vi.spyOn(wpRepo, "findWordpressConnectionByPrefix").mockResolvedValue(fakeConnection as any);

      const mockTx = {
        wordpressConnection: {
          update: vi.fn().mockResolvedValue(fakeConnection),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      vi.spyOn(wpCollector, "detectWordpressAnomalies").mockResolvedValue({
        detectedCount: 0,
        resolvedCount: 0,
        issueIds: [],
      });

      const result = await ingestWordpressWebhook(realToken, {
        wpVersion: "6.7.1",
        phpVersion: "8.3.4",
        debugMode: false,
        httpsEnforced: true,
      });

      expect(result.ok).toBe(true);
      expect(result.websiteId).toBe("site-1");
      expect(mockTx.wordpressConnection.update).toHaveBeenCalled();
    });
  });

  describe("disconnectWordpressSite", () => {
    it("deletes connection and cleans up WordPress findings", async () => {
      vi.spyOn(wpRepo, "findWordpressConnection").mockResolvedValue({
        id: "conn-1",
        websiteId: "site-1",
      } as any);

      const mockTx = {
        wordpressConnection: {
          deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        issue: {
          findMany: vi.fn().mockResolvedValue([{ fingerprint: "fp-wp-core" }]),
        },
      };

      vi.spyOn(tenantDb, "withTenantTransaction").mockImplementation(async (_scope, callback) => {
        return callback(mockTx as any);
      });

      const resolveSpy = vi.spyOn(issueEngine, "resolveFindingScoped").mockResolvedValue();

      await disconnectWordpressSite(scope, "site-1");

      expect(mockTx.wordpressConnection.deleteMany).toHaveBeenCalled();
      expect(resolveSpy).toHaveBeenCalled();
      expect(healthRepo.captureHealthScoreSnapshot).toHaveBeenCalled();
    });
  });
});

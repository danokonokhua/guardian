import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, wpServiceMock, wpRepoMock, billingMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  wpServiceMock: {
    connectWordpressSite: vi.fn(),
    syncWordpressSite: vi.fn(),
    disconnectWordpressSite: vi.fn(),
    ingestWordpressWebhook: vi.fn(),
  },
  wpRepoMock: {
    findWordpressConnection: vi.fn(),
  },
  billingMock: {
    getBillingSummary: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requirePermission: permissionMock,
}));

vi.mock("@/services/integrations/wordpress/service", () => wpServiceMock);
vi.mock("@/services/integrations/wordpress/repository", () => wpRepoMock);
vi.mock("@/services/billing/repository", () => billingMock);

import {
  GET as getWpRoute,
  POST as postWpRoute,
  DELETE as deleteWpRoute,
} from "@/app/api/v1/organizations/[organizationId]/websites/[websiteId]/wordpress/route";

import { POST as postSyncRoute } from "@/app/api/v1/organizations/[organizationId]/websites/[websiteId]/wordpress/sync/route";
import { POST as postWebhookRoute } from "@/app/api/v1/integrations/wordpress/webhook/route";

const ORG = "org-111";
const WEBSITE = "site-222";
const context = {
  organizationId: ORG,
  user: { userId: "user-1", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "OWNER" },
};

describe("WordPress Connect API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(context);
    billingMock.getBillingSummary.mockResolvedValue({ plan: "PRO" });
  });

  describe("GET /wordpress", () => {
    it("returns connection data and active plan", async () => {
      wpRepoMock.findWordpressConnection.mockResolvedValue({
        id: "conn-1",
        websiteId: WEBSITE,
        wpVersion: "6.7.1",
      });

      const response = await getWpRoute(new Request("https://guardian.test"), {
        params: Promise.resolve({ organizationId: ORG, websiteId: WEBSITE }),
      });

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.connection.wpVersion).toBe("6.7.1");
      expect(json.data.plan).toBe("PRO");
    });
  });

  describe("POST /wordpress", () => {
    it("connects a site in sandbox mode successfully", async () => {
      wpServiceMock.connectWordpressSite.mockResolvedValue({
        connection: { id: "conn-1", websiteId: WEBSITE, isSandbox: true },
        token: "gcon_sand_12345",
      });

      const response = await postWpRoute(
        new Request("https://guardian.test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isSandbox: true }),
        }),
        { params: Promise.resolve({ organizationId: ORG, websiteId: WEBSITE }) },
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.token).toBe("gcon_sand_12345");
      expect(wpServiceMock.connectWordpressSite).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ websiteId: WEBSITE, isSandbox: true }),
      );
    });
  });

  describe("POST /wordpress/sync", () => {
    it("triggers sync with simulateFix option", async () => {
      wpServiceMock.syncWordpressSite.mockResolvedValue({
        connection: { id: "conn-1", wpVersion: "6.7.1" },
        anomalies: { detectedCount: 0, resolvedCount: 2, issueIds: [] },
      });

      const response = await postSyncRoute(
        new Request("https://guardian.test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ simulateFix: true }),
        }),
        { params: Promise.resolve({ organizationId: ORG, websiteId: WEBSITE }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.connection.wpVersion).toBe("6.7.1");
      expect(wpServiceMock.syncWordpressSite).toHaveBeenCalledWith(expect.anything(), WEBSITE, {
        simulateFix: true,
      });
    });
  });

  describe("DELETE /wordpress", () => {
    it("disconnects the site", async () => {
      wpServiceMock.disconnectWordpressSite.mockResolvedValue(undefined);

      const response = await deleteWpRoute(
        new Request("https://guardian.test", { method: "DELETE" }),
        { params: Promise.resolve({ organizationId: ORG, websiteId: WEBSITE }) },
      );

      expect(response.status).toBe(200);
      expect(wpServiceMock.disconnectWordpressSite).toHaveBeenCalledWith(
        expect.anything(),
        WEBSITE,
      );
    });
  });

  describe("POST /api/v1/integrations/wordpress/webhook", () => {
    it("rejects request without Bearer token with 401", async () => {
      const response = await postWebhookRoute(
        new Request("https://guardian.test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wpVersion: "6.7.1" }),
        }),
      );

      expect(response.status).toBe(401);
    });

    it("ingests payload when valid Bearer token is provided", async () => {
      wpServiceMock.ingestWordpressWebhook.mockResolvedValue({
        ok: true,
        syncedAt: "2026-10-03T10:00:00.000Z",
        websiteId: WEBSITE,
      });

      const response = await postWebhookRoute(
        new Request("https://guardian.test", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer gcon_live_1234567890abcdef",
          },
          body: JSON.stringify({ wpVersion: "6.7.1", phpVersion: "8.3.0" }),
        }),
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.ok).toBe(true);
      expect(wpServiceMock.ingestWordpressWebhook).toHaveBeenCalledWith(
        "gcon_live_1234567890abcdef",
        expect.objectContaining({ wpVersion: "6.7.1" }),
      );
    });
  });
});

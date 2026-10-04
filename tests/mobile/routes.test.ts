import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, mobileServiceMock, repositoryMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  mobileServiceMock: {
    getMobileHubOverview: vi.fn(),
    sendTestPushToUser: vi.fn(),
  },
  repositoryMock: {
    upsertPushSubscriptionRecord: vi.fn(),
    deletePushSubscriptionRecord: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requirePermission: permissionMock,
}));

vi.mock("@/services/mobile/push-dispatcher", () => mobileServiceMock);
vi.mock("@/services/mobile/repository", () => repositoryMock);

import { GET as getMobileOverviewRoute } from "@/app/api/v1/organizations/[organizationId]/mobile/route";
import { GET as getVapidKeyRoute } from "@/app/api/v1/organizations/[organizationId]/mobile/push/public-key/route";
import { POST as postSubscribeRoute } from "@/app/api/v1/organizations/[organizationId]/mobile/push/subscribe/route";
import { POST as postUnsubscribeRoute } from "@/app/api/v1/organizations/[organizationId]/mobile/push/unsubscribe/route";
import { POST as postTestPushRoute } from "@/app/api/v1/organizations/[organizationId]/mobile/push/test/route";

const ORG = "org-mobile-123";
const authContext = {
  organizationId: ORG,
  user: { userId: "user-operator", email: "operator@example.com" },
  membership: { organizationId: ORG, role: "ADMIN" },
};

describe("Mobile Platform REST API Routes (PRD §21 & §24)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(authContext);
  });

  describe("GET /mobile", () => {
    it("returns mobile hub overview and registered devices", async () => {
      mobileServiceMock.getMobileHubOverview.mockResolvedValue({
        deviceCount: 2,
        devices: [],
        vapidPublicKey: "BF-mock-vapid-key",
      });

      const response = await getMobileOverviewRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/mobile`),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.deviceCount).toBe(2);
      expect(permissionMock).toHaveBeenCalledWith(ORG, "org:read");
    });
  });

  describe("GET /mobile/push/public-key", () => {
    it("returns public VAPID key", async () => {
      const response = await getVapidKeyRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/mobile/push/public-key`),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.vapidPublicKey).toBeDefined();
    });
  });

  describe("POST /mobile/push/subscribe", () => {
    it("registers push subscription and returns 201", async () => {
      repositoryMock.upsertPushSubscriptionRecord.mockResolvedValue({
        id: "sub-123",
        endpoint: "https://fcm.googleapis.com/fcm/send/token",
      });

      const response = await postSubscribeRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/mobile/push/subscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: "https://fcm.googleapis.com/fcm/send/token",
            keys: { p256dh: "key_p256", auth: "key_auth" },
            userAgent: "iOS Safari",
          }),
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.subscribed).toBe(true);
      expect(json.data.deviceId).toBe("sub-123");
    });
  });

  describe("POST /mobile/push/unsubscribe", () => {
    it("deletes push subscription successfully", async () => {
      repositoryMock.deletePushSubscriptionRecord.mockResolvedValue(true);

      const response = await postUnsubscribeRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/mobile/push/unsubscribe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: "https://fcm.googleapis.com/fcm/send/token",
          }),
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.unsubscribed).toBe(true);
    });
  });

  describe("POST /mobile/push/test", () => {
    it("dispatches test push alert to user devices", async () => {
      mobileServiceMock.sendTestPushToUser.mockResolvedValue({
        dispatchedCount: 1,
        results: [{ endpoint: "https://fcm.googleapis.com/test", success: true }],
      });

      const response = await postTestPushRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/mobile/push/test`, {
          method: "POST",
        }),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.dispatchedCount).toBe(1);
    });
  });
});

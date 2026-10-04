import { describe, expect, it, vi } from "vitest";
import {
  broadcastPushToOrganization,
  getMobileHubOverview,
  sendPushNotification,
  sendTestPushToUser,
} from "@/services/mobile/push-dispatcher";
import * as repository from "@/services/mobile/repository";

vi.mock("@/services/mobile/repository");

const mockTenantScope = {
  organizationId: "org-mobile-test",
  userId: "user-mobile-operator",
  role: "ADMIN" as const,
};

describe("Mobile Push Notification Services (PRD §21 & §24)", () => {
  it("dispatches simulated push notifications successfully in test environment", async () => {
    const mockDevice: repository.MobileSubscriptionRecord = {
      id: "device-1",
      organizationId: mockTenantScope.organizationId,
      userId: mockTenantScope.userId,
      endpoint: "https://guardian.test/push/device-1",
      p256dhKey: "mock_p256dh",
      authKey: "mock_auth",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await sendPushNotification(mockDevice, {
      title: "🚨 UPTIME DOWN: Primary API",
      body: "Endpoint returned 502 Bad Gateway.",
      url: "/revenue",
      severity: "CRITICAL",
    });

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.endpoint).toBe(mockDevice.endpoint);
  });

  it("broadcasts push alerts to all active devices in an organization", async () => {
    vi.spyOn(repository, "listSubscriptionsGlobalForOrg").mockResolvedValue([
      {
        id: "device-a",
        organizationId: mockTenantScope.organizationId,
        userId: "user-1",
        endpoint: "https://guardian.test/push/a",
        p256dhKey: "key_a",
        authKey: "auth_a",
        userAgent: "Android Chrome",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "device-b",
        organizationId: mockTenantScope.organizationId,
        userId: "user-2",
        endpoint: "https://guardian.test/push/b",
        p256dhKey: "key_b",
        authKey: "auth_b",
        userAgent: "iOS Safari",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const results = await broadcastPushToOrganization(mockTenantScope.organizationId, {
      title: "🛡️ SSL Expiring in 3 Days",
      body: "Action required on domain.com",
    });

    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(true);
  });

  it("sends real-time verification ping to operator devices", async () => {
    vi.spyOn(repository, "listSubscriptionsForUser").mockResolvedValue([
      {
        id: "device-1",
        organizationId: mockTenantScope.organizationId,
        userId: mockTenantScope.userId,
        endpoint: "https://guardian.test/push/1",
        p256dhKey: "k",
        authKey: "a",
        userAgent: "iOS Safari",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const res = await sendTestPushToUser(mockTenantScope, mockTenantScope.userId);
    expect(res.dispatchedCount).toBe(1);
    expect(res.results[0]?.success).toBe(true);
  });

  it("gathers Mobile Hub overview metrics", async () => {
    vi.spyOn(repository, "listSubscriptionsForOrg").mockResolvedValue([
      {
        id: "dev-1",
        organizationId: mockTenantScope.organizationId,
        userId: "u-1",
        endpoint: "https://guardian.test/push/dev-1",
        p256dhKey: "k1",
        authKey: "a1",
        userAgent: "Mobile Safari",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const overview = await getMobileHubOverview(mockTenantScope);
    expect(overview.deviceCount).toBe(1);
    expect(overview.devices).toHaveLength(1);
    expect(overview.vapidPublicKey).toBeDefined();
  });
});

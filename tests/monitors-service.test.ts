import { describe, expect, it, vi } from "vitest";

import type { TenantScope } from "@/db/tenant";

const { findMock, updateMock } = vi.hoisted(() => ({
  findMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/services/monitors/repository", () => ({
  findMonitor: findMock,
  updateMonitor: updateMock,
  createMonitor: vi.fn(),
  listMonitors: vi.fn(),
}));

import { triggerConfiguredMonitor, updateConfiguredMonitor } from "@/services/monitors/service";

const scope: TenantScope = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  userId: "44444444-4444-4444-8444-444444444444",
  role: "OWNER",
};

describe("monitor management service", () => {
  it("updates only validated mutable settings", async () => {
    updateMock.mockResolvedValue({ id: "monitor-1", enabled: false });
    await expect(updateConfiguredMonitor(scope, "monitor-1", { enabled: false })).resolves.toEqual({
      id: "monitor-1",
      enabled: false,
    });
    expect(updateMock).toHaveBeenCalledWith(scope, "monitor-1", { enabled: false });
  });

  it("enqueues a tenant-bound monitor.check job", async () => {
    findMock.mockResolvedValue({
      id: "monitor-1",
      websiteId: "website-1",
      type: "UPTIME",
      enabled: true,
      frequencyMinutes: 5,
      config: {},
    });
    const boss = {
      createQueue: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue("job-1"),
    } as never;

    await expect(triggerConfiguredMonitor(scope, "monitor-1", boss)).resolves.toEqual({
      monitorId: "monitor-1",
      jobId: "job-1",
    });
    expect((boss as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith(
      "monitor.check",
      {
        organizationId: scope.organizationId,
        websiteId: "website-1",
        monitorId: "monitor-1",
        type: "UPTIME",
      },
      expect.objectContaining({ singletonKey: "monitor:monitor-1" }),
    );
  });

  it("fails closed when a monitor is outside the tenant", async () => {
    findMock.mockResolvedValue(null);
    await expect(
      triggerConfiguredMonitor(scope, "missing", { createQueue: vi.fn(), send: vi.fn() } as never),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

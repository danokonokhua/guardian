import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import { setIdentityRepository } from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";
import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import type { ApiErrorBody, V1SuccessBody } from "@/types/api";

const { updateMock, triggerMock } = vi.hoisted(() => ({
  updateMock: vi.fn(),
  triggerMock: vi.fn(),
}));

vi.mock("@/services/monitors/service", () => ({
  updateConfiguredMonitor: updateMock,
  triggerConfiguredMonitor: triggerMock,
}));

import { PATCH } from "@/app/api/v1/organizations/[organizationId]/monitors/[monitorId]/route";
import { POST } from "@/app/api/v1/organizations/[organizationId]/monitors/[monitorId]/run/route";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const MONITOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_A = "44444444-4444-4444-8444-444444444444";

const user: AuthenticatedUser = {
  userId: USER_A,
  email: "alice@example.test",
  name: "Alice",
  status: "ACTIVE",
};
const memberships: Array<MembershipContext & { userId: string }> = [
  { userId: USER_A, organizationId: ORG_A, role: "MEMBER", status: "ACTIVE" },
];
const identityRepository: IdentityRepository = {
  async findUserById(userId) {
    return userId === USER_A ? user : null;
  },
  async findMembership(userId, organizationId) {
    const found = memberships.find(
      (membership) => membership.userId === userId && membership.organizationId === organizationId,
    );
    return found
      ? { organizationId: found.organizationId, role: found.role, status: found.status }
      : null;
  },
  async listMemberships(userId) {
    return memberships
      .filter((membership) => membership.userId === userId)
      .map(({ organizationId, role, status }) => ({ organizationId, role, status }));
  },
};

const adapter: AuthAdapter = { getSessionIdentity: async () => ({ userId: USER_A }) };

function params(values: Record<string, string>) {
  return { params: Promise.resolve(values) };
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

beforeEach(() => {
  setIdentityRepository(identityRepository);
  setAuthAdapter(adapter);
  updateMock.mockReset();
  triggerMock.mockReset();
});

afterEach(() => {
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

describe("monitor management routes", () => {
  it("updates a monitor for an active member", async () => {
    updateMock.mockResolvedValue({ id: MONITOR_A, enabled: false });
    const response = await PATCH(
      new Request("https://guardian.test", {
        method: "PATCH",
        body: JSON.stringify({ enabled: false }),
        headers: { "content-type": "application/json", "x-request-id": "monitor-update-123" },
      }),
      params({ organizationId: ORG_A, monitorId: MONITOR_A }),
    );
    expect(response.status).toBe(200);
    expect((await body<V1SuccessBody<unknown>>(response)).data).toEqual({
      id: MONITOR_A,
      enabled: false,
    });
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A }),
      MONITOR_A,
      {
        enabled: false,
      },
    );
  });

  it("masks cross-tenant updates with 404", async () => {
    const response = await PATCH(
      new Request("https://guardian.test", {
        method: "PATCH",
        body: JSON.stringify({ enabled: true }),
      }),
      params({ organizationId: ORG_B, monitorId: MONITOR_A }),
    );
    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated trigger requests", async () => {
    setAuthAdapter(new AnonymousAuthAdapter());
    const response = await POST(
      new Request("https://guardian.test", { method: "POST" }),
      params({ organizationId: ORG_A, monitorId: MONITOR_A }),
    );
    expect(response.status).toBe(401);
    expect((await body<ApiErrorBody>(response)).error.code).toBe("UNAUTHORIZED");
  });

  it("enqueues an immediate monitor check through the worker queue", async () => {
    triggerMock.mockResolvedValue({ monitorId: MONITOR_A, jobId: "job-123" });
    const response = await POST(
      new Request("https://guardian.test", { method: "POST" }),
      params({ organizationId: ORG_A, monitorId: MONITOR_A }),
    );
    expect(response.status).toBe(202);
    expect((await body<V1SuccessBody<unknown>>(response)).data).toEqual({
      monitorId: MONITOR_A,
      jobId: "job-123",
    });
    expect(triggerMock).toHaveBeenCalledOnce();
  });
});

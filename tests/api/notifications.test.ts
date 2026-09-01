import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import { setIdentityRepository } from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";
import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import type { ApiErrorBody, V1SuccessBody } from "@/types/api";

const { listMock, markReadMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  markReadMock: vi.fn(),
}));

vi.mock("@/services/notifications/repository", () => ({
  listInAppNotifications: listMock,
  markInAppNotificationRead: markReadMock,
}));

import { GET as listHandler } from "@/app/api/v1/organizations/[organizationId]/notifications/route";
import { PATCH as readHandler } from "@/app/api/v1/organizations/[organizationId]/notifications/[notificationId]/read/route";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const NOTIFICATION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOTIFICATION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
    const membership = memberships.find(
      (candidate) => candidate.userId === userId && candidate.organizationId === organizationId,
    );
    return membership
      ? {
          organizationId: membership.organizationId,
          role: membership.role,
          status: membership.status,
        }
      : null;
  },
  async listMemberships(userId) {
    return memberships
      .filter((candidate) => candidate.userId === userId)
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
  listMock.mockReset();
  markReadMock.mockReset();
});

afterEach(() => {
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

describe("notification API routes", () => {
  it("rejects unauthenticated listing with 401 and request ID", async () => {
    setAuthAdapter(new AnonymousAuthAdapter());
    const response = await listHandler(
      new Request("https://guardian.test/api/v1/organizations/" + ORG_A + "/notifications"),
      params({ organizationId: ORG_A }),
    );

    expect(response.status).toBe(401);
    const result = await body<ApiErrorBody>(response);
    expect(result.error.code).toBe("UNAUTHORIZED");
    expect(response.headers.get("x-request-id")).toBe(result.error.requestId);
  });

  it("lists tenant-scoped notifications and propagates a valid request ID", async () => {
    listMock.mockResolvedValue([{ id: NOTIFICATION_A, title: "Down" }]);
    const response = await listHandler(
      new Request("https://guardian.test/api/v1/organizations/" + ORG_A + "/notifications", {
        headers: { "x-request-id": "notification-req-123" },
      }),
      params({ organizationId: ORG_A }),
    );

    expect(response.status).toBe(200);
    const result = await body<V1SuccessBody<unknown[]>>(response);
    expect(result.data).toEqual([{ id: NOTIFICATION_A, title: "Down" }]);
    expect(result.requestId).toBe("notification-req-123");
    expect(response.headers.get("x-request-id")).toBe("notification-req-123");
    expect(listMock).toHaveBeenCalledOnce();
  });

  it("masks cross-tenant organization access with 404", async () => {
    const response = await listHandler(
      new Request("https://guardian.test/api/v1/organizations/" + ORG_B + "/notifications"),
      params({ organizationId: ORG_B }),
    );

    expect(response.status).toBe(404);
    expect(listMock).not.toHaveBeenCalled();
    const raw = await response.text();
    expect(raw).not.toContain(ORG_B);
  });

  it("marks the current user's notification as read", async () => {
    markReadMock.mockResolvedValue({ count: 1 });
    const response = await readHandler(
      new Request(
        `https://guardian.test/api/v1/organizations/${ORG_A}/notifications/${NOTIFICATION_A}/read`,
      ),
      params({ organizationId: ORG_A, notificationId: NOTIFICATION_A }),
    );

    expect(response.status).toBe(200);
    const result = await body<V1SuccessBody<{ updated: boolean }>>(response);
    expect(result.data.updated).toBe(true);
    expect(markReadMock).toHaveBeenCalledOnce();
  });

  it("returns 404 for an unauthorized notification ID", async () => {
    markReadMock.mockResolvedValue({ count: 0 });
    const response = await readHandler(
      new Request(
        `https://guardian.test/api/v1/organizations/${ORG_A}/notifications/${NOTIFICATION_B}/read`,
      ),
      params({ organizationId: ORG_A, notificationId: NOTIFICATION_B }),
    );

    expect(response.status).toBe(404);
    const result = await body<ApiErrorBody>(response);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.requestId).toBe(response.headers.get("x-request-id"));
  });

  it("rejects malformed path IDs with a validation error", async () => {
    const response = await listHandler(
      new Request("https://guardian.test/api/v1/organizations/not-an-id/notifications"),
      params({ organizationId: "not-an-id" }),
    );

    expect(response.status).toBe(400);
    const result = await body<ApiErrorBody>(response);
    expect(result.error.code).toBe("VALIDATION_ERROR");
  });
});

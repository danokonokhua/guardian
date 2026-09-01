import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import { setIdentityRepository } from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";
import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";

const { overviewMock } = vi.hoisted(() => ({ overviewMock: vi.fn() }));
vi.mock("@/services/health/repository", () => ({ readHealthOverview: overviewMock }));

import { GET } from "@/app/api/v1/organizations/[organizationId]/health/route";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const USER = "44444444-4444-4444-8444-444444444444";
const user: AuthenticatedUser = {
  userId: USER,
  email: "a@example.test",
  name: null,
  status: "ACTIVE",
};
const identity: IdentityRepository = {
  async findUserById(id) {
    return id === USER ? user : null;
  },
  async findMembership(id, organizationId) {
    return id === USER && organizationId === ORG
      ? { organizationId: ORG, role: "VIEWER", status: "ACTIVE" }
      : null;
  },
  async listMemberships() {
    return [{ organizationId: ORG, role: "VIEWER", status: "ACTIVE" } satisfies MembershipContext];
  },
};
const params = (organizationId: string) => ({ params: Promise.resolve({ organizationId }) });

beforeEach(() => {
  setIdentityRepository(identity);
  setAuthAdapter({ getSessionIdentity: async () => ({ userId: USER }) } satisfies AuthAdapter);
  overviewMock.mockReset();
});
afterEach(() => {
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

describe("health overview route", () => {
  it("returns tenant health data with request ID", async () => {
    overviewMock.mockResolvedValue({
      summary: {},
      recentResults: [],
      issues: [],
      responseHistory: [],
    });
    const response = await GET(
      new Request("https://guardian.test", { headers: { "x-request-id": "health-req-123" } }),
      params(ORG),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("health-req-123");
    expect(overviewMock).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG }));
  });

  it("masks cross-tenant access", async () => {
    const response = await GET(new Request("https://guardian.test"), params(OTHER));
    expect(response.status).toBe(404);
    expect(overviewMock).not.toHaveBeenCalled();
  });
});

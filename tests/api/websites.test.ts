import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import { setIdentityRepository } from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";
import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import type { ApiErrorBody, V1SuccessBody } from "@/types/api";

const { listMock, onboardMock, verifyMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  onboardMock: vi.fn(),
  verifyMock: vi.fn(),
}));
vi.mock("@/services/websites/service", () => ({
  listConfiguredWebsites: listMock,
  onboardWebsite: onboardMock,
  verifyWebsite: verifyMock,
}));

import { GET, POST } from "@/app/api/v1/organizations/[organizationId]/websites/route";
import { POST as VERIFY } from "@/app/api/v1/organizations/[organizationId]/websites/[websiteId]/verify/route";

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
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
const params = (organizationId: string) => ({ params: Promise.resolve({ organizationId }) });

beforeEach(() => {
  setIdentityRepository(identityRepository);
  setAuthAdapter(adapter);
  listMock.mockReset();
  onboardMock.mockReset();
  verifyMock.mockReset();
});
afterEach(() => {
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

describe("website onboarding routes", () => {
  it("lists websites for an active member", async () => {
    listMock.mockResolvedValue([{ id: "website-1", hostname: "example.com" }]);
    const response = await GET(new Request("https://guardian.test"), params(ORG_A));
    expect(response.status).toBe(200);
    expect(((await response.json()) as V1SuccessBody<unknown[]>).data).toEqual([
      { id: "website-1", hostname: "example.com" },
    ]);
  });

  it("creates a website for an active member", async () => {
    onboardMock.mockResolvedValue({ id: "website-1", hostname: "example.com" });
    const response = await POST(
      new Request("https://guardian.test", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
      }),
      params(ORG_A),
    );
    expect(response.status).toBe(201);
    expect(onboardMock).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG_A }), {
      url: "https://example.com",
    });
  });

  it("masks cross-tenant website access", async () => {
    const response = await GET(new Request("https://guardian.test"), params(ORG_B));
    expect(response.status).toBe(404);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated onboarding", async () => {
    setAuthAdapter(new AnonymousAuthAdapter());
    const response = await POST(
      new Request("https://guardian.test", {
        method: "POST",
        body: JSON.stringify({ url: "https://example.com" }),
      }),
      params(ORG_A),
    );
    expect(response.status).toBe(401);
    expect(((await response.json()) as ApiErrorBody).error.code).toBe("UNAUTHORIZED");
  });

  it("runs verification only inside the active organization", async () => {
    verifyMock.mockResolvedValue({ verified: true, status: "VERIFIED" });
    const response = await VERIFY(new Request("https://guardian.test", { method: "POST" }), {
      params: Promise.resolve({
        organizationId: ORG_A,
        websiteId: "33333333-3333-4333-8333-333333333333",
      }),
    });
    expect(response.status).toBe(200);
    expect(verifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A }),
      "33333333-3333-4333-8333-333333333333",
    );
  });
});

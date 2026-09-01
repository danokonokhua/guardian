import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/auth/context";

const { permissionMock, listMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  listMock: vi.fn(),
}));
vi.mock("@/lib/auth/context", () => ({ requirePermission: permissionMock }));
vi.mock("@/services/members/repository", () => ({ listActiveOrganizationMembers: listMock }));

import { GET } from "@/app/api/v1/organizations/[organizationId]/members/route";

const ORG = "11111111-1111-4111-8111-111111111111";
const context = {
  organizationId: ORG,
  user: {
    userId: "22222222-2222-4222-8222-222222222222",
    email: "a@example.test",
    status: "ACTIVE",
  },
  membership: { organizationId: ORG, role: "OWNER", status: "ACTIVE" },
} as unknown as OrganizationContext;

beforeEach(() => {
  permissionMock.mockReset().mockResolvedValue(context);
  listMock
    .mockReset()
    .mockResolvedValue([
      { userId: context.user.userId, email: context.user.email, name: null, role: "OWNER" },
    ]);
});

describe("organization member directory route", () => {
  it("returns active members for the authorized tenant", async () => {
    const response = await GET(
      new Request("https://guardian.test", { headers: { "x-request-id": "members-req-123" } }),
      { params: Promise.resolve({ organizationId: ORG }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("members-req-123");
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG }));
  });
});

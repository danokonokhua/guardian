import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OrganizationContext } from "@/lib/auth/context";
import { NotFoundError } from "@/lib/errors";

const { permissionMock, listMock, getMock, applyMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  listMock: vi.fn(),
  getMock: vi.fn(),
  applyMock: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({ requirePermission: permissionMock }));
vi.mock("@/services/issues/service", () => ({
  listOrganizationIssues: listMock,
  getOrganizationIssue: getMock,
  applyIssueLifecycle: applyMock,
}));

import { GET as listGET } from "@/app/api/v1/organizations/[organizationId]/issues/route";
import {
  GET as detailGET,
  PATCH,
} from "@/app/api/v1/organizations/[organizationId]/issues/[issueId]/route";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const ISSUE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER = "44444444-4444-4444-8444-444444444444";
const context = {
  organizationId: ORG,
  user: { userId: USER, email: "owner@example.test", status: "ACTIVE" },
  membership: { organizationId: ORG, role: "OWNER", status: "ACTIVE" },
} as unknown as OrganizationContext;

const params = (values: Record<string, string>) => ({ params: Promise.resolve(values) });

beforeEach(() => {
  permissionMock.mockReset().mockResolvedValue(context);
  listMock.mockReset().mockResolvedValue([]);
  getMock.mockReset().mockResolvedValue({ id: ISSUE, status: "OPEN" });
  applyMock.mockReset().mockResolvedValue({ id: ISSUE, status: "ACKNOWLEDGED" });
});

describe("issue routes", () => {
  it("lists tenant issues with request ID propagation", async () => {
    const response = await listGET(
      new Request("https://guardian.test", { headers: { "x-request-id": "issues-req-123" } }),
      params({ organizationId: ORG }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toBe("issues-req-123");
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG }),
      expect.objectContaining({ orderBy: "lastSeenAt", order: "desc" }),
    );
  });

  it("passes status, severity, and sorting filters to the tenant service", async () => {
    const response = await listGET(
      new Request(`https://guardian.test?status=OPEN&severity=HIGH&sort=severity&order=asc`),
      params({ organizationId: ORG }),
    );
    expect(response.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(expect.anything(), {
      status: "OPEN",
      severity: "HIGH",
      orderBy: "severity",
      order: "asc",
      cursor: undefined,
      limit: 25,
    });
  });

  it("masks cross-tenant detail access as 404 before repository access", async () => {
    permissionMock.mockRejectedValue(new NotFoundError("Organization"));
    const response = await detailGET(
      new Request("https://guardian.test"),
      params({ organizationId: OTHER_ORG, issueId: ISSUE }),
    );
    expect(response.status).toBe(404);
    expect(getMock).not.toHaveBeenCalled();
  });

  it("returns issue details and applies lifecycle actions", async () => {
    const detail = await detailGET(
      new Request("https://guardian.test"),
      params({ organizationId: ORG, issueId: ISSUE }),
    );
    expect(detail.status).toBe(200);

    const response = await PATCH(
      new Request("https://guardian.test", {
        method: "PATCH",
        body: JSON.stringify({ action: "RESOLVE" }),
      }),
      params({ organizationId: ORG, issueId: ISSUE }),
    );
    expect(response.status).toBe(200);
    expect(applyMock).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG, userId: USER }),
      ISSUE,
      { action: "RESOLVE" },
    );
  });
});

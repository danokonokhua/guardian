import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, roleMock, cooServiceMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  roleMock: vi.fn(),
  cooServiceMock: {
    getCooDirectivesOverview: vi.fn(),
    generateCooDirectivesForOrg: vi.fn(),
    executeCooDirective: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({
  requirePermission: permissionMock,
  requireRole: roleMock,
}));

vi.mock("@/services/ai-coo/service", () => cooServiceMock);

import {
  GET as getOverviewRoute,
  POST as postGenerateDirectivesRoute,
} from "@/app/api/v1/organizations/[organizationId]/coo/route";
import { POST as postExecuteDirectiveRoute } from "@/app/api/v1/organizations/[organizationId]/coo/[directiveId]/execute/route";

const ORG = "org-coo-123";
const authContext = {
  organizationId: ORG,
  user: { userId: "user-admin", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "ADMIN" },
};

describe("AI COO Platform REST API Routes (PRD §16, §17, §23, §25)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(authContext);
    roleMock.mockResolvedValue(authContext);
  });

  describe("GET /api/v1/organizations/[organizationId]/coo", () => {
    it("returns executive directives overview and briefing summary", async () => {
      cooServiceMock.getCooDirectivesOverview.mockResolvedValue({
        totalDirectives: 3,
        p0ImmediateCount: 1,
        p1ThisWeekCount: 1,
        totalOpportunityValueUsd: 12000,
        executiveBriefingSummary: "Urgent P0 directive active",
        directives: [],
      });

      const response = await getOverviewRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/coo`),
        { params: Promise.resolve({ organizationId: ORG }) }
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.totalDirectives).toBe(3);
      expect(json.data.p0ImmediateCount).toBe(1);
      expect(json.data.totalOpportunityValueUsd).toBe(12000);
      expect(permissionMock).toHaveBeenCalledWith(ORG, "org:read");
    });
  });

  describe("POST /api/v1/organizations/[organizationId]/coo", () => {
    it("synthesizes cross-domain directives with ADMIN role verification", async () => {
      cooServiceMock.generateCooDirectivesForOrg.mockResolvedValue({
        websitesEvaluated: 2,
        directivesGenerated: 4,
      });

      const response = await postGenerateDirectivesRoute(
        new Request(`https://guardian.test/api/v1/organizations/${ORG}/coo`, {
          method: "POST",
        }),
        { params: Promise.resolve({ organizationId: ORG }) }
      );

      expect(response.status).toBe(201);
      const json = await response.json();
      expect(json.data.websitesEvaluated).toBe(2);
      expect(json.data.directivesGenerated).toBe(4);
      expect(roleMock).toHaveBeenCalledWith(ORG, "ADMIN");
    });
  });

  describe("POST /api/v1/organizations/[organizationId]/coo/[directiveId]/execute", () => {
    it("executes an authorized directive action", async () => {
      cooServiceMock.executeCooDirective.mockResolvedValue({
        id: "dir-1",
        status: "EXECUTED",
      });

      const response = await postExecuteDirectiveRoute(
        new Request(
          `https://guardian.test/api/v1/organizations/${ORG}/coo/dir-1/execute`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "EXECUTE" }),
          }
        ),
        {
          params: Promise.resolve({
            organizationId: ORG,
            directiveId: "dir-1",
          }),
        }
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.status).toBe("EXECUTED");
      expect(roleMock).toHaveBeenCalledWith(ORG, "ADMIN");
      expect(cooServiceMock.executeCooDirective).toHaveBeenCalledWith(
        expect.anything(),
        "dir-1",
        "EXECUTE"
      );
    });

    it("rejects invalid execution action payloads", async () => {
      const response = await postExecuteDirectiveRoute(
        new Request(
          `https://guardian.test/api/v1/organizations/${ORG}/coo/dir-1/execute`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "INVALID_ACTION" }),
          }
        ),
        {
          params: Promise.resolve({
            organizationId: ORG,
            directiveId: "dir-1",
          }),
        }
      );

      expect(response.status).toBe(400);
    });
  });
});

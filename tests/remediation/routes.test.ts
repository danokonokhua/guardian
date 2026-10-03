import { beforeEach, describe, expect, it, vi } from "vitest";

const { permissionMock, remediationServiceMock } = vi.hoisted(() => ({
  permissionMock: vi.fn(),
  remediationServiceMock: {
    getRemediationOverview: vi.fn(),
    proposeRemediation: vi.fn(),
    approveAndExecuteRemediation: vi.fn(),
    rollbackRemediation: vi.fn(),
    rejectRemediation: vi.fn(),
  },
}));

vi.mock("@/lib/auth/context", () => ({ requirePermission: permissionMock }));
vi.mock("@/services/remediation/service", () => remediationServiceMock);

import {
  GET as getRemediationRoute,
  POST as postRemediationRoute,
} from "@/app/api/v1/organizations/[organizationId]/remediation/route";

import { POST as postApproveRoute } from "@/app/api/v1/organizations/[organizationId]/remediation/[actionId]/approve/route";
import { POST as postRollbackRoute } from "@/app/api/v1/organizations/[organizationId]/remediation/[actionId]/rollback/route";
import { POST as postRejectRoute } from "@/app/api/v1/organizations/[organizationId]/remediation/[actionId]/reject/route";

const ORG = "org-rem-99";
const ACTION_ID = "act-123";
const context = {
  organizationId: ORG,
  user: { userId: "user-1", email: "admin@example.com" },
  membership: { organizationId: ORG, role: "OWNER" },
};

describe("Automated Remediation API Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    permissionMock.mockResolvedValue(context);
  });

  describe("GET /remediation", () => {
    it("returns remediation overview and recent actions", async () => {
      remediationServiceMock.getRemediationOverview.mockResolvedValue({
        totalActions: 10,
        pendingApprovalsCount: 2,
        completedCount: 7,
        rolledBackCount: 1,
        verificationPassRatePct: 87.5,
        recentActions: [],
      });

      const response = await getRemediationRoute(
        new Request("https://guardian.test/api/v1/organizations/org-rem-99/remediation"),
        { params: Promise.resolve({ organizationId: ORG }) },
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data.overview.totalActions).toBe(10);
      expect(json.data.overview.pendingApprovalsCount).toBe(2);
    });
  });

  describe("POST /remediation (Propose)", () => {
    it("proposes remediation action plan", async () => {
      remediationServiceMock.proposeRemediation.mockResolvedValue({
        id: ACTION_ID,
        title: "Disable Debug Mode",
        status: "PENDING_APPROVAL",
      });

      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actionType: "DISABLE_WP_DEBUG",
          problem: "WP_DEBUG exposed on production route",
        }),
      });

      const res = await postRemediationRoute(req, {
        params: Promise.resolve({ organizationId: ORG }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.data.title).toBe("Disable Debug Mode");
    });
  });

  describe("POST /remediation/[actionId]/approve", () => {
    it("approves and dispatches execution", async () => {
      remediationServiceMock.approveAndExecuteRemediation.mockResolvedValue({
        id: ACTION_ID,
        status: "COMPLETED",
      });

      const res = await postApproveRoute(new Request("https://guardian.test", { method: "POST" }), {
        params: Promise.resolve({ organizationId: ORG, actionId: ACTION_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("COMPLETED");
    });
  });

  describe("POST /remediation/[actionId]/rollback", () => {
    it("rolls back executed action", async () => {
      remediationServiceMock.rollbackRemediation.mockResolvedValue({
        id: ACTION_ID,
        status: "ROLLED_BACK",
      });

      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Manual revert test" }),
      });

      const res = await postRollbackRoute(req, {
        params: Promise.resolve({ organizationId: ORG, actionId: ACTION_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("ROLLED_BACK");
    });
  });

  describe("POST /remediation/[actionId]/reject", () => {
    it("rejects proposed action", async () => {
      remediationServiceMock.rejectRemediation.mockResolvedValue({
        id: ACTION_ID,
        status: "REJECTED",
      });

      const req = new Request("https://guardian.test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Not needed" }),
      });

      const res = await postRejectRoute(req, {
        params: Promise.resolve({ organizationId: ORG, actionId: ACTION_ID }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data.status).toBe("REJECTED");
    });
  });
});


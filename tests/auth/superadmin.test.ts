import { beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import { setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import {
  listCurrentUserMemberships,
  requireOrganizationMember,
  requireRole,
  requirePermission,
  setIdentityRepository,
} from "@/lib/auth/context";
import { isSuperadminEmail, SUPERADMIN_EMAILS } from "@/lib/auth/superadmin";
import {
  assertCanAddWebsite,
  assertCanAddBusiness,
  assertCanAddMember,
  assertCanUseFeature,
  assertCanUseMultiClientDashboard,
  assertCanUseAiCoo,
  assertCanUseAutomatedRemediation,
} from "@/lib/billing/entitlements";

const SUPER_USER: AuthenticatedUser = {
  userId: "super-1",
  email: "danielokonokhua@gmail.com",
  name: "Daniel Okonokhua",
  status: "ACTIVE",
};

const STANDARD_USER: AuthenticatedUser = {
  userId: "user-standard",
  email: "standard@example.test",
  name: "Standard User",
  status: "ACTIVE",
};

class StubAdapter implements AuthAdapter {
  constructor(private readonly user: AuthenticatedUser | null) {}
  async getSessionIdentity() {
    return this.user ? { userId: this.user.userId } : null;
  }
}

function fakeRepo(
  users: AuthenticatedUser[],
  memberships: (MembershipContext & { userId: string })[],
): IdentityRepository {
  return {
    async findUserById(id) {
      return users.find((u) => u.userId === id) ?? null;
    },
    async findMembership(userId, organizationId) {
      return (
        memberships.find((m) => m.userId === userId && m.organizationId === organizationId) ?? null
      );
    },
    async listMemberships(userId) {
      return memberships.filter((m) => m.userId === userId);
    },
  };
}

describe("Superadmin access and elevation", () => {
  it("recognizes danielokonokhua@gmail.com as superadmin", () => {
    expect(SUPERADMIN_EMAILS.has("danielokonokhua@gmail.com")).toBe(true);
    expect(isSuperadminEmail("danielokonokhua@gmail.com")).toBe(true);
    expect(isSuperadminEmail("  DANIELOKONOKHUA@GMAIL.COM ")).toBe(true);
    expect(isSuperadminEmail("other@example.com")).toBe(false);
  });

  describe("Context and authorization elevation", () => {
    beforeEach(() => {
      setAuthAdapter(new StubAdapter(SUPER_USER));
      setIdentityRepository(
        fakeRepo(
          [SUPER_USER],
          [
            {
              userId: "super-1",
              organizationId: "org-1",
              role: "VIEWER", // even if stored as VIEWER
              status: "ACTIVE",
            },
          ],
        ),
      );
    });

    it("elevates memberships to OWNER in listCurrentUserMemberships", async () => {
      const memberships = await listCurrentUserMemberships();
      expect(memberships).toHaveLength(1);
      expect(memberships[0]?.role).toBe("OWNER");
    });

    it("elevates membership to OWNER in requireOrganizationMember", async () => {
      const context = await requireOrganizationMember("org-1");
      expect(context.membership.role).toBe("OWNER");
      expect(context.user.email).toBe("danielokonokhua@gmail.com");
    });

    it("authorizes requireRole at the highest level (OWNER)", async () => {
      const context = await requireRole("org-1", "OWNER");
      expect(context.membership.role).toBe("OWNER");
    });

    it("authorizes requirePermission for any permission without throwing", async () => {
      const context = await requirePermission("org-1", "org:delete");
      expect(context.membership.role).toBe("OWNER");
    });
  });

  describe("Billing and Entitlements for ENTERPRISE plan", () => {
    it("never throws for ENTERPRISE plan across limits and capabilities", () => {
      expect(() => assertCanAddWebsite(99999, "ENTERPRISE")).not.toThrow();
      expect(() => assertCanAddBusiness(99999, "ENTERPRISE")).not.toThrow();
      expect(() => assertCanAddMember(99999, "ENTERPRISE")).not.toThrow();
      expect(() => assertCanUseFeature("ENTERPRISE", "continuousMonitoring")).not.toThrow();
      expect(() => assertCanUseMultiClientDashboard("ENTERPRISE")).not.toThrow();
      expect(() => assertCanUseAiCoo("ENTERPRISE")).not.toThrow();
      expect(() => assertCanUseAutomatedRemediation("ENTERPRISE")).not.toThrow();
    });
  });
});

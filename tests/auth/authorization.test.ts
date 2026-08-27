import { describe, expect, it } from "vitest";

import type { MemberRole } from "@prisma/client";

import type { AuthenticatedUser, MembershipContext } from "@/lib/auth/identity";
import {
  effectiveRole,
  hasAtLeastRole,
  isActiveMembership,
  isActiveUser,
} from "@/lib/auth/authorization";

/** Test dummies only — no real identities. */
function member(
  role: MemberRole,
  status: MembershipContext["status"] = "ACTIVE",
): MembershipContext {
  return { organizationId: "org-1", role, status };
}

function user(status: AuthenticatedUser["status"] = "ACTIVE"): AuthenticatedUser {
  return { userId: "user-1", email: "owner@example.test", name: null, status };
}

describe("authorization foundation (deny-by-default)", () => {
  it("accepts each approved role at its own rank and above", () => {
    expect(hasAtLeastRole(member("VIEWER"), "VIEWER")).toBe(true);
    expect(hasAtLeastRole(member("MEMBER"), "VIEWER")).toBe(true);
    expect(hasAtLeastRole(member("ADMIN"), "MEMBER")).toBe(true);
    expect(hasAtLeastRole(member("OWNER"), "ADMIN")).toBe(true);
    expect(hasAtLeastRole(member("OWNER"), "OWNER")).toBe(true);
  });

  it("denies roles below the required rank", () => {
    expect(hasAtLeastRole(member("VIEWER"), "MEMBER")).toBe(false);
    expect(hasAtLeastRole(member("MEMBER"), "ADMIN")).toBe(false);
    expect(hasAtLeastRole(member("ADMIN"), "OWNER")).toBe(false);
  });

  it("denies missing, invited, or revoked memberships regardless of role", () => {
    expect(hasAtLeastRole(null, "VIEWER")).toBe(false);
    expect(hasAtLeastRole(undefined, "OWNER")).toBe(false);
    expect(hasAtLeastRole(member("OWNER", "INVITED"), "VIEWER")).toBe(false);
    expect(hasAtLeastRole(member("ADMIN", "REVOKED"), "VIEWER")).toBe(false);
  });

  it("only ACTIVE users and memberships authorize", () => {
    expect(isActiveUser(user())).toBe(true);
    expect(isActiveUser(user("SUSPENDED"))).toBe(false);
    expect(isActiveUser(user("DELETED"))).toBe(false);
    expect(isActiveUser(null)).toBe(false);
    expect(isActiveMembership(member("MEMBER"))).toBe(true);
    expect(isActiveMembership(member("MEMBER", "INVITED"))).toBe(false);
    expect(isActiveMembership(null)).toBe(false);
  });

  it("effectiveRole returns the role only for authorizing memberships", () => {
    expect(effectiveRole(member("ADMIN"))).toBe("ADMIN");
    expect(effectiveRole(member("ADMIN", "REVOKED"))).toBeNull();
    expect(effectiveRole(null)).toBeNull();
  });
});

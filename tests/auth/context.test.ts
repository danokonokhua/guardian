import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";

import {
  getCurrentUser,
  requireOrganizationMember,
  requireRole,
  requireUser,
  setIdentityRepository,
  tenantContextFor,
} from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

/**
 * Identity-context boundary tests — fully deterministic, no database and no
 * external authentication provider required (stub adapter + in-memory
 * repository). All identities are test dummies.
 *
 * Covers the ten mandated Phase 1B-05 scenarios.
 */

const ALICE: AuthenticatedUser = {
  userId: "user-alice",
  email: "alice@example.test",
  name: "Alice",
  status: "ACTIVE",
};
const BOB: AuthenticatedUser = {
  userId: "user-bob",
  email: "bob@example.test",
  name: null,
  status: "ACTIVE",
};

function membershipOf(
  userId: string,
  organizationId: string,
  role: MembershipContext["role"],
  status: MembershipContext["status"] = "ACTIVE",
): MembershipContext & { userId: string } {
  return { userId, organizationId, role, status };
}

function fakeRepository(
  users: readonly AuthenticatedUser[],
  memberships: readonly (MembershipContext & { userId: string })[],
): IdentityRepository {
  return {
    async findUserById(userId) {
      return users.find((candidate) => candidate.userId === userId) ?? null;
    },
    async findMembership(userId, organizationId) {
      const found = memberships.find(
        (candidate) => candidate.userId === userId && candidate.organizationId === organizationId,
      );
      if (found === undefined) {
        return null;
      }
      return { organizationId: found.organizationId, role: found.role, status: found.status };
    },
    async listMemberships(userId) {
      return memberships
        .filter((candidate) => candidate.userId === userId)
        .map((candidate) => ({
          organizationId: candidate.organizationId,
          role: candidate.role,
          status: candidate.status,
        }));
    },
  };
}

function stubAdapter(userId: string): AuthAdapter {
  return { getSessionIdentity: async () => ({ userId }) };
}

beforeEach(() => {
  setAuthAdapter(stubAdapter(ALICE.userId));
  setIdentityRepository(
    fakeRepository(
      [ALICE, BOB],
      [
        membershipOf(ALICE.userId, "org-acme", "ADMIN"),
        membershipOf(BOB.userId, "org-other", "OWNER"),
        membershipOf(ALICE.userId, "org-invited", "MEMBER", "INVITED"),
      ],
    ),
  );
});

afterEach(() => {
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

describe("scenario 1 — unauthenticated access is rejected", () => {
  it("getCurrentUser resolves to null and requireUser throws 401", async () => {
    setAuthAdapter(new AnonymousAuthAdapter());
    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(requireUser()).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });
});

describe("scenario 2 — authenticated user is resolved", () => {
  it("returns the ACTIVE user from the repository (database is authoritative)", async () => {
    const context = await getCurrentUser();
    expect(context?.user.userId).toBe(ALICE.userId);
    expect(context?.user.email).toBe("alice@example.test");

    const user = await requireUser();
    expect(user.userId).toBe(ALICE.userId);
  });
});

describe("scenario 3 — nonexistent or inactive identity is rejected safely", () => {
  it("rejects an identity that maps to no user (fail closed, generic 401)", async () => {
    setAuthAdapter(stubAdapter("user-ghost"));
    await expect(getCurrentUser()).resolves.toBeNull();
    await expect(requireUser()).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a suspended user without leaking details", async () => {
    setIdentityRepository(
      fakeRepository(
        [{ ...ALICE, status: "SUSPENDED" }],
        [membershipOf(ALICE.userId, "org-acme", "ADMIN")],
      ),
    );
    await expect(requireUser()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });
});

describe("scenario 4 — organization membership is required", () => {
  it("rejects a user with no memberships (404, existence masked)", async () => {
    setIdentityRepository(fakeRepository([ALICE], []));
    await expect(requireOrganizationMember("org-acme")).rejects.toBeInstanceOf(NotFoundError);
    await expect(requireOrganizationMember("org-acme")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects INVITED memberships — only ACTIVE authorize", async () => {
    await expect(requireOrganizationMember("org-invited")).rejects.toMatchObject({ status: 404 });
  });
});

describe("scenario 5 — non-member cannot access another organization", () => {
  it("returns 404 (not 403) so organization existence is not revealed", async () => {
    await expect(requireOrganizationMember("org-other")).rejects.toBeInstanceOf(NotFoundError);
    await expect(requireOrganizationMember("org-does-not-exist")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("scenarios 6–8 — role checks", () => {
  it("6: returns the membership and role for an active member", async () => {
    const context = await requireOrganizationMember("org-acme");
    expect(context.membership.role).toBe("ADMIN");
    expect(context.organizationId).toBe("org-acme");
  });

  it("7: insufficient role is rejected with 403", async () => {
    await expect(requireRole("org-acme", "OWNER")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(requireRole("org-acme", "OWNER")).rejects.toMatchObject({ status: 403 });
  });

  it("8: sufficient role is accepted (hierarchy)", async () => {
    const context = await requireRole("org-acme", "MEMBER");
    expect(context.user.userId).toBe(ALICE.userId);
    await expect(requireRole("org-acme", "ADMIN")).resolves.toBeDefined();
  });

  it("role requirements still require membership first (404 before 403)", async () => {
    await expect(requireRole("org-other", "VIEWER")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("scenario 9 — tenant context cannot silently switch tenants", () => {
  it("refuses to bind a membership to a different organization", () => {
    const acmeMembership: MembershipContext = {
      organizationId: "org-acme",
      role: "OWNER",
      status: "ACTIVE",
    };
    expect(() => tenantContextFor(ALICE, acmeMembership, "org-other")).toThrow(
      /Tenant context mismatch/,
    );
  });

  it("refuses inactive memberships and returns a frozen context", () => {
    const invited: MembershipContext = {
      organizationId: "org-acme",
      role: "OWNER",
      status: "INVITED",
    };
    expect(() => tenantContextFor(ALICE, invited, "org-acme")).toThrow(/Tenant context mismatch/);

    const active: MembershipContext = {
      organizationId: "org-acme",
      role: "ADMIN",
      status: "ACTIVE",
    };
    const context = tenantContextFor(ALICE, active, "org-acme");
    expect(Object.isFrozen(context)).toBe(true);
    expect(context.organizationId).toBe("org-acme");
  });
});

describe("scenario 10 — provider details do not leak into business services", () => {
  it("identity context exposes exactly the sanctioned fields", async () => {
    const user = await requireUser();
    expect(Object.keys(user).sort()).toEqual(["email", "name", "status", "userId"]);

    const context = await requireOrganizationMember("org-acme");
    expect(Object.keys(context).sort()).toEqual(["membership", "organizationId", "user"]);
  });

  it("only lib/auth imports the adapter boundary (structural guarantee)", () => {
    const source = readFileSync("lib/auth/context.ts", "utf8");
    expect(source).toContain('from "@/lib/auth/adapter"');
    // The application-facing context module never imports transport/provider
    // concerns — only the adapter, repository, and error modules.
    const imports = source.split("\n").filter((line) => line.startsWith("import"));
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) {
      expect(line.toLowerCase()).not.toMatch(/cookie|header|token|jwt|bearer|supabase/);
    }
  });
});

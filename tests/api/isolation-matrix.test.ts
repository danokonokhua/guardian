import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import { setIdentityRepository } from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";

import { GET as orgContextHandler } from "@/app/api/v1/organizations/[organizationId]/context/route";
import type { ApiErrorBody } from "@/types/api";

/**
 * API tenant-isolation matrix (Phase 1B-07).
 *
 * Pattern: every protected /api/v1 route should be registered in PROTECTED_ROUTES
 * so each scenario is exercised against it. Today that is the Phase 1B-06
 * architectural endpoint; future routes join the matrix without redesign.
 *
 * Fully offline (stub adapter + in-memory repository). All IDs are dummies.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORG_A = "11111111-1111-4111-8111-111111111111";
const ORG_B = "22222222-2222-4222-8222-222222222222";
const ORG_GHOST = "33333333-3333-4333-8333-333333333333";

const ALICE: AuthenticatedUser = {
  userId: "44444444-4444-4444-8444-444444444444",
  email: "alice@example.test",
  name: "Alice",
  status: "ACTIVE",
};
const BOB: AuthenticatedUser = {
  userId: "55555555-5555-4555-8555-555555555555",
  email: "bob@example.test",
  name: null,
  status: "ACTIVE",
};
const CAROL: AuthenticatedUser = {
  userId: "66666666-6666-4666-8666-666666666666",
  email: "carol@example.test",
  name: null,
  status: "ACTIVE",
};
const DAVE: AuthenticatedUser = {
  userId: "77777777-7777-4777-8777-777777777777",
  email: "dave@example.test",
  name: null,
  status: "ACTIVE",
};

interface StoredMembership extends MembershipContext {
  userId: string;
}

// Alice: ADMIN of A. Bob: OWNER of B only. Carol: INVITED to B. Dave: REVOKED from B.
const MEMBERSHIPS: StoredMembership[] = [
  { userId: ALICE.userId, organizationId: ORG_A, role: "ADMIN", status: "ACTIVE" },
  { userId: BOB.userId, organizationId: ORG_B, role: "OWNER", status: "ACTIVE" },
  { userId: CAROL.userId, organizationId: ORG_B, role: "MEMBER", status: "INVITED" },
  { userId: DAVE.userId, organizationId: ORG_B, role: "MEMBER", status: "REVOKED" },
];

const fakeRepository: IdentityRepository = {
  async findUserById(userId) {
    return [ALICE, BOB, CAROL, DAVE].find((candidate) => candidate.userId === userId) ?? null;
  },
  async findMembership(userId, organizationId) {
    const found = MEMBERSHIPS.find(
      (candidate) => candidate.userId === userId && candidate.organizationId === organizationId,
    );
    return found
      ? { organizationId: found.organizationId, role: found.role, status: found.status }
      : null;
  },
  async listMemberships(userId) {
    return MEMBERSHIPS.filter((candidate) => candidate.userId === userId).map((candidate) => ({
      organizationId: candidate.organizationId,
      role: candidate.role,
      status: candidate.status,
    }));
  },
};

const PROTECTED_ROUTES = [
  {
    name: "GET /api/v1/organizations/{id}/context",
    invoke: (
      organizationId: string,
      overrides?: { headers?: Record<string, string>; query?: string },
    ) => {
      const headers = new Headers(overrides?.headers);
      return orgContextHandler(
        new Request(
          `https://guardian.test/api/v1/organizations/${organizationId}/context${overrides?.query ?? ""}`,
          {
            headers,
          },
        ),
        { params: Promise.resolve({ organizationId }) },
      );
    },
  },
] as const;

const as = (user: AuthenticatedUser): AuthAdapter => ({
  getSessionIdentity: async () => ({ userId: user.userId }),
});

beforeEach(() => {
  setIdentityRepository(fakeRepository);
});

afterEach(() => {
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

for (const route of PROTECTED_ROUTES) {
  describe(`isolation matrix — ${route.name}`, () => {
    it("1. Anonymous → 401 with requestId", async () => {
      setAuthAdapter(new AnonymousAuthAdapter());
      const response = await route.invoke(ORG_A);
      expect(response.status).toBe(401);
      const body = (await response.json()) as ApiErrorBody;
      expect(body.error.code).toBe("UNAUTHORIZED");
      expect(body.error.requestId).toMatch(UUID);
    });

    it("2. Active member of Org A accessing Org A → success", async () => {
      setAuthAdapter(as(ALICE));
      const response = await route.invoke(ORG_A);
      expect(response.status).toBe(200);
    });

    it("3. Active member of Org A accessing Org B → 404", async () => {
      setAuthAdapter(as(ALICE));
      const response = await route.invoke(ORG_B);
      expect(response.status).toBe(404);
    });

    it("4. INVITED membership → 404", async () => {
      setAuthAdapter(as(CAROL));
      const response = await route.invoke(ORG_B);
      expect(response.status).toBe(404);
    });

    it("5. REVOKED membership → 404", async () => {
      setAuthAdapter(as(DAVE));
      const response = await route.invoke(ORG_B);
      expect(response.status).toBe(404);
    });

    it("6. Insufficient permission/role → 403 (member, higher gate)", async () => {
      setAuthAdapter(as(ALICE)); // ADMIN of A; require OWNER
      const response = await route.invoke(ORG_A, { query: "?minimumRole=OWNER" });
      expect(response.status).toBe(403);
    });

    it("7. Unknown organization UUID → 404", async () => {
      setAuthAdapter(as(ALICE));
      const response = await route.invoke(ORG_GHOST);
      expect(response.status).toBe(404);
    });

    it("8. Client cannot override tenant via headers/query/userId/role", async () => {
      setAuthAdapter(as(ALICE)); // ADMIN of A only
      const attempts: Array<{ headers?: Record<string, string>; query?: string }> = [
        { headers: { "x-org-id": ORG_B, "x-user-id": BOB.userId } },
        {
          headers: { "x-organization": ORG_B },
          query: `?organizationId=${ORG_B}&userId=${BOB.userId}&role=OWNER`,
        },
        { query: `?actingAs=${BOB.userId}&organizationId=${ORG_B}` },
      ];
      for (const attempt of attempts) {
        const response = await route.invoke(ORG_B, attempt);
        expect(response.status).toBe(404); // never 200 — identity came only from the adapter
      }
      // And the same overrides cannot grant a higher role inside Org A:
      const response = await route.invoke(ORG_A, {
        headers: { "x-user-id": BOB.userId },
        query: `?role=OWNER&userId=${BOB.userId}`,
      });
      expect(response.status).toBe(200); // Alice remains herself…
      const body = (await response.json()) as {
        data: { member: { userId: string; role: string } };
      };
      expect(body.data.member.userId).toBe(ALICE.userId); // …not Bob
      expect(body.data.member.role).toBe("ADMIN");
    });

    it("9. Cross-tenant 404 does not echo the probed organization", async () => {
      setAuthAdapter(as(ALICE));
      const response = await route.invoke(ORG_B);
      const raw = await response.text();
      expect(response.status).toBe(404);
      expect(raw).not.toContain(ORG_B); // never echo the probed tenant identifier
      expect(raw).not.toContain("Tenant B");
    });

    it("10. requestId behavior unchanged (header + body, validated propagation)", async () => {
      setAuthAdapter(new AnonymousAuthAdapter());
      const response = await route.invoke(ORG_A, {
        headers: { "x-request-id": "matrix-req-12345" },
      });
      const body = (await response.json()) as ApiErrorBody;
      expect(body.error.requestId).toBe("matrix-req-12345");
      expect(response.headers.get("x-request-id")).toBe("matrix-req-12345");
    });
  });
}

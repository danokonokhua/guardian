import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AuthenticatedUser, IdentityRepository, MembershipContext } from "@/lib/auth/identity";
import { AnonymousAuthAdapter, setAuthAdapter, type AuthAdapter } from "@/lib/auth/adapter";
import { setIdentityRepository } from "@/lib/auth/context";
import { prismaIdentityRepository } from "@/lib/auth/prisma-repository";

import { GET as healthHandler } from "@/app/api/v1/health/route";
import { GET as orgContextHandler } from "@/app/api/v1/organizations/[organizationId]/context/route";
import type { ApiErrorBody, V1OrganizationContextData, V1SuccessBody } from "@/types/api";

/**
 * /api/v1 boundary tests — the twelve mandated Phase 1B-06 scenarios.
 * Fully offline: stub auth adapter + in-memory identity repository (the exact
 * seams built in Phase 1B-05). No database, no provider, no network.
 * All identities are uuid-shaped test dummies.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORG_ACME = "11111111-1111-4111-8111-111111111111";
const ORG_OTHER = "22222222-2222-4222-8222-222222222222";
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

interface StoredMembership extends MembershipContext {
  userId: string;
}

const MEMBERSHIPS: StoredMembership[] = [
  { userId: ALICE.userId, organizationId: ORG_ACME, role: "ADMIN", status: "ACTIVE" },
  { userId: BOB.userId, organizationId: ORG_OTHER, role: "OWNER", status: "ACTIVE" },
  {
    userId: BOB.userId,
    organizationId: ORG_ACME,
    role: "VIEWER",
    status: "INVITED",
  },
];

const fakeRepository: IdentityRepository = {
  async findUserById(userId) {
    return [ALICE, BOB].find((candidate) => candidate.userId === userId) ?? null;
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

function stubAdapter(userId: string): AuthAdapter {
  return { getSessionIdentity: async () => ({ userId }) };
}

function orgContextRequest(organizationId: string, query = "", requestId?: string): Request {
  const headers = new Headers();
  if (requestId !== undefined) {
    headers.set("x-request-id", requestId);
  }
  return new Request(
    `https://guardian.test/api/v1/organizations/${organizationId}/context${query}`,
    {
      headers,
    },
  );
}

function routeParams(organizationId: string): { params: Promise<Record<string, string>> } {
  return { params: Promise.resolve({ organizationId }) };
}

async function bodyOf<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

beforeEach(() => {
  setIdentityRepository(fakeRepository);
});

afterEach(() => {
  setAuthAdapter(new AnonymousAuthAdapter());
  setIdentityRepository(prismaIdentityRepository);
});

describe("scenario 1 — /api/v1/health standardized response", () => {
  it("returns the success envelope with matching request id", async () => {
    const response = await healthHandler(new Request("https://guardian.test/api/v1/health"));

    expect(response.status).toBe(200);
    const body = await bodyOf<V1SuccessBody<{ status: string; service: string }>>(response);
    expect(body.data.status).toBe("ok");
    expect(body.data.service).toBe("guardian");
    expect(body.requestId).toMatch(UUID);
    expect(response.headers.get("x-request-id")).toBe(body.requestId);
  });
});

describe("scenario 2 — protected endpoint rejects unauthenticated with 401", () => {
  it("returns UNAUTHORIZED with requestId and no internal detail", async () => {
    setAuthAdapter(new AnonymousAuthAdapter());
    const response = await orgContextHandler(orgContextRequest(ORG_ACME), routeParams(ORG_ACME));

    expect(response.status).toBe(401);
    const body = await bodyOf<ApiErrorBody>(response);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.requestId).toMatch(UUID);
    expect(JSON.stringify(body)).not.toMatch(/stack|prisma|postgresql|at \w+\(/i);
  });
});

describe("scenario 3 — authenticated identity reaches the protected boundary", () => {
  it("returns the membership snapshot for an ACTIVE member", async () => {
    setAuthAdapter(stubAdapter(ALICE.userId));
    const response = await orgContextHandler(orgContextRequest(ORG_ACME), routeParams(ORG_ACME));

    expect(response.status).toBe(200);
    const body = await bodyOf<V1SuccessBody<V1OrganizationContextData>>(response);
    expect(body.data.organization.id).toBe(ORG_ACME);
    expect(body.data.member.role).toBe("ADMIN");
    expect(body.data.member.email).toBe("alice@example.test");
    expect(response.headers.get("x-request-id")).toBe(body.requestId);
  });

  it("propagates a valid client request id and replaces an invalid one", async () => {
    setAuthAdapter(stubAdapter(ALICE.userId));

    const valid = await orgContextHandler(
      orgContextRequest(ORG_ACME, "", "client-req-12345"),
      routeParams(ORG_ACME),
    );
    const validBody = await bodyOf<V1SuccessBody<unknown>>(valid);
    expect(validBody.requestId).toBe("client-req-12345");

    const invalid = await orgContextHandler(
      orgContextRequest(ORG_ACME, "", "../../etc/passwd"),
      routeParams(ORG_ACME),
    );
    const invalidBody = await bodyOf<V1SuccessBody<unknown>>(invalid);
    expect(invalidBody.requestId).toMatch(UUID);
  });
});

describe("scenario 4/5/10 — non-member and cross-tenant access fail closed", () => {
  it("returns 404 for an organization the identity is not an active member of", async () => {
    setAuthAdapter(stubAdapter(ALICE.userId)); // Alice has no membership in ORG_OTHER
    const response = await orgContextHandler(orgContextRequest(ORG_OTHER), routeParams(ORG_OTHER));

    expect(response.status).toBe(404);
    const body = await bodyOf<ApiErrorBody>(response);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 for a nonexistent organization (existence masked)", async () => {
    setAuthAdapter(stubAdapter(ALICE.userId));
    const response = await orgContextHandler(orgContextRequest(ORG_GHOST), routeParams(ORG_GHOST));
    expect(response.status).toBe(404);
  });

  it("returns 404 for INVITED (not yet ACTIVE) memberships", async () => {
    setAuthAdapter(stubAdapter(BOB.userId));
    const response = await orgContextHandler(orgContextRequest(ORG_ACME), routeParams(ORG_ACME));
    expect(response.status).toBe(404);
  });

  it("never echoes the requested tenant in cross-tenant responses", async () => {
    setAuthAdapter(stubAdapter(ALICE.userId));
    const response = await orgContextHandler(orgContextRequest(ORG_OTHER), routeParams(ORG_OTHER));
    const raw = await response.text();
    expect(raw).not.toContain(ORG_OTHER);
  });
});

describe("scenarios 6–8 — role gates and validation", () => {
  beforeEach(() => {
    setAuthAdapter(stubAdapter(ALICE.userId)); // ADMIN of ORG_ACME
  });

  it("returns 403 when minimumRole exceeds the granted role", async () => {
    const response = await orgContextHandler(
      orgContextRequest(ORG_ACME, "?minimumRole=OWNER"),
      routeParams(ORG_ACME),
    );
    expect(response.status).toBe(403);
    const body = await bodyOf<ApiErrorBody>(response);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.requestId).toMatch(UUID);
  });

  it("succeeds when the granted role meets the requirement", async () => {
    const response = await orgContextHandler(
      orgContextRequest(ORG_ACME, "?minimumRole=MEMBER"),
      routeParams(ORG_ACME),
    );
    expect(response.status).toBe(200);
    const body = await bodyOf<V1SuccessBody<V1OrganizationContextData>>(response);
    expect(body.data.member.role).toBe("ADMIN");
  });

  it("rejects an unknown minimumRole with a standardized 400 validation error", async () => {
    const response = await orgContextHandler(
      orgContextRequest(ORG_ACME, "?minimumRole=SORCERER"),
      routeParams(ORG_ACME),
    );
    expect(response.status).toBe(400);
    const body = await bodyOf<ApiErrorBody>(response);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(body.error.details)).toContain("minimumRole");
    expect(JSON.stringify(body.error.details)).not.toContain("SORCERER");
  });

  it("rejects a malformed organization id with a standardized 400", async () => {
    const response = await orgContextHandler(
      orgContextRequest("definitely-not-a-uuid"),
      routeParams("definitely-not-a-uuid"),
    );
    expect(response.status).toBe(400);
    const body = await bodyOf<ApiErrorBody>(response);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("scenario 9/11 — sanitized errors and preserved 1B-05 semantics", () => {
  it("error bodies never contain stack traces or internals", async () => {
    setAuthAdapter(new AnonymousAuthAdapter());
    const response = await orgContextHandler(orgContextRequest(ORG_ACME), routeParams(ORG_ACME));
    const raw = await response.text();
    expect(raw).not.toMatch(/stack|node_modules|prisma|postgresql:\/\//i);
    expect(raw).not.toMatch(/at \w+ \(.*\//);
  });

  it("every error response carries the request id in body and header", async () => {
    setAuthAdapter(new AnonymousAuthAdapter());
    const response = await orgContextHandler(orgContextRequest(ORG_ACME), routeParams(ORG_ACME));
    const body = await bodyOf<ApiErrorBody>(response);
    expect(response.headers.get("x-request-id")).toBe(body.error.requestId);
  });
});

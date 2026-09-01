import { describe, expect, it } from "vitest";

import type { MemberRole } from "@prisma/client";

import { can, PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "@/lib/auth/permissions";

/**
 * Exhaustive permission-matrix tests (Phase 1B-07). The EXPECTED matrix below
 * is the authoritative Phase 1A §10 matrix; every role × permission cell is
 * asserted against `can()` AND against the exact ROLE_PERMISSIONS sets.
 */

// The expected truth — spelled out, not derived from the implementation.
const EXPECTED: Record<MemberRole, readonly Permission[]> = {
  OWNER: [
    "org:read",
    "org:update",
    "org:delete",
    "member:read",
    "member:invite",
    "member:manage",
    "audit:read",
    "business:read",
    "business:create",
    "business:update",
    "business:delete",
    "website:read",
    "website:create",
    "website:update",
    "website:delete",
    "website:scan",
    "monitoring:read",
    "monitoring:manage",
    "issue:read",
    "issue:manage",
    "recommendation:read",
    "recommendation:manage",
    "health:read",
    "report:read",
  ],
  ADMIN: [
    "org:read",
    "org:update",
    "member:read",
    "member:invite",
    "member:manage",
    "audit:read",
    "business:read",
    "business:create",
    "business:update",
    "business:delete",
    "website:read",
    "website:create",
    "website:update",
    "website:delete",
    "website:scan",
    "monitoring:read",
    "monitoring:manage",
    "issue:read",
    "issue:manage",
    "recommendation:read",
    "recommendation:manage",
    "health:read",
    "report:read",
  ],
  MEMBER: [
    "org:read",
    "member:read",
    "business:read",
    "business:create",
    "business:update",
    "business:delete",
    "website:read",
    "website:create",
    "website:update",
    "website:delete",
    "website:scan",
    "monitoring:read",
    "monitoring:manage",
    "issue:read",
    "issue:manage",
    "recommendation:read",
    "recommendation:manage",
    "health:read",
    "report:read",
  ],
  VIEWER: [
    "org:read",
    "member:read",
    "business:read",
    "website:read",
    "monitoring:read",
    "issue:read",
    "recommendation:read",
    "health:read",
    "report:read",
  ],
};

const ROLES: readonly MemberRole[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

describe("ROLE_PERMISSIONS exact-set equality", () => {
  for (const role of ROLES) {
    it(`${role} set matches the authoritative matrix exactly`, () => {
      expect([...ROLE_PERMISSIONS[role]].sort()).toEqual([...EXPECTED[role]].sort());
    });
  }

  it("contains no duplicate grants", () => {
    for (const role of ROLES) {
      const granted = ROLE_PERMISSIONS[role];
      expect(new Set(granted).size).toBe(granted.length);
    }
  });
});

describe("can() — every role × every permission", () => {
  for (const role of ROLES) {
    for (const permission of PERMISSIONS) {
      const expected = EXPECTED[role].includes(permission);
      it(`${role} + ${permission} → ${expected}`, () => {
        expect(can(role, permission)).toBe(expected);
      });
    }
  }
});

describe("can() — explicit security-critical denials", () => {
  it("ADMIN never receives org:delete", () => {
    expect(can("ADMIN", "org:delete")).toBe(false);
  });

  it("MEMBER never receives org:update / org:delete / member:invite / member:manage / audit:read", () => {
    expect(can("MEMBER", "org:update")).toBe(false);
    expect(can("MEMBER", "org:delete")).toBe(false);
    expect(can("MEMBER", "member:invite")).toBe(false);
    expect(can("MEMBER", "member:manage")).toBe(false);
    expect(can("MEMBER", "audit:read")).toBe(false);
  });

  it("VIEWER never receives create/update/delete/manage permissions", () => {
    expect(can("VIEWER", "business:create")).toBe(false);
    expect(can("VIEWER", "website:update")).toBe(false);
    expect(can("VIEWER", "issue:manage")).toBe(false);
    expect(can("VIEWER", "monitoring:manage")).toBe(false);
    expect(can("VIEWER", "org:update")).toBe(false);
    expect(can("VIEWER", "member:manage")).toBe(false);
    expect(can("VIEWER", "website:delete")).toBe(false);
  });

  it("VIEWER retains read-only permissions", () => {
    expect(can("VIEWER", "org:read")).toBe(true);
    expect(can("VIEWER", "report:read")).toBe(true);
  });
});

describe("can() — deny-by-default for unknown inputs", () => {
  it("unknown permission strings → false for every role", () => {
    for (const role of ROLES) {
      expect(can(role, "org:nuke")).toBe(false);
      expect(can(role, "superuser:everything")).toBe(false);
      expect(can(role, "")).toBe(false);
    }
  });

  it("unknown roles → false for every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(can("SUPERUSER", permission)).toBe(false);
      expect(can("owner", permission)).toBe(false); // case must be exact
    }
  });

  it("null/undefined role → false", () => {
    expect(can(null, "org:read")).toBe(false);
    expect(can(undefined, "org:read")).toBe(false);
  });
});

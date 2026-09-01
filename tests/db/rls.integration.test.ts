import { execSync } from "node:child_process";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@prisma/client";

import { withGucContext, withTenantTransaction } from "@/db/tenant";
import type { TenantScope } from "@/db/tenant";

/**
 * RLS integration tests — GATED on TEST_DATABASE_URL.
 *
 * No PostgreSQL database exists in the development sandbox, so this entire
 * suite SKIPS cleanly unless an operator/CI provides a THROWAWAY database via
 * TEST_DATABASE_URL (see docs/TENANCY.md — never point it at production).
 * When enabled it applies all committed migrations, seeds two tenants, and
 * verifies the Phase 1B-07 row-level security guarantees for real.
 * All IDs are uuid-shaped test dummies.
 */

const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"] as string | undefined;
const RLS_DATABASE_URL = TEST_DATABASE_URL?.replace(
  "postgresql://postgres:postgres@",
  "postgresql://guardian_app:postgres@",
);

const ORG_A = "aaaaaaaa-0000-4000-8000-000000000001";
const ORG_B = "bbbbbbbb-0000-4000-8000-000000000002";
const USER_A = "aaaaaaaa-1111-4111-8111-111111111111";
const USER_B = "bbbbbbbb-1111-4111-8111-111111111111";

const tenant = (orgId: string, userId: string): TenantScope =>
  Object.freeze({ organizationId: orgId, userId, role: "OWNER" });

describe.skipIf(TEST_DATABASE_URL === undefined)(
  "RLS integration (database-layer isolation)",
  () => {
    let prisma: PrismaClient;

    beforeAll(() => {
      prisma = new PrismaClient({ datasources: { db: { url: RLS_DATABASE_URL } } });
      // Deterministic schema + RLS policies on the throwaway test database.
      execSync("npx prisma migrate deploy --schema db/schema.prisma", {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
        stdio: "pipe",
        timeout: 120_000,
      });
    });

    beforeAll(async () => {
      // Seed both tenants inside GUC-scoped transactions (RLS-compliant writes).
      await prisma.user.createMany({
        data: [
          { id: USER_A, email: "tenant-a@example.test", name: "A" },
          { id: USER_B, email: "tenant-b@example.test", name: "B" },
        ],
      });
      for (const [orgId, userId, name] of [
        [ORG_A, USER_A, "Tenant A"],
        [ORG_B, USER_B, "Tenant B"],
      ] as const) {
        await withGucContext(
          { organizationId: orgId, userId },
          (tx) =>
            tx.organization.create({
              data: { id: orgId, name, slug: `slug-${orgId.slice(0, 8)}`, ownerId: userId },
            }),
          prisma,
        );
        await withGucContext(
          { organizationId: orgId, userId },
          (tx) =>
            tx.organizationMember.create({
              data: { organizationId: orgId, userId, role: "OWNER", status: "ACTIVE" },
            }),
          prisma,
        );
        await withGucContext(
          { organizationId: orgId, userId },
          (tx) => tx.business.create({ data: { id: orgId, organizationId: orgId, name } }),
          prisma,
        );
      }
    });

    afterAll(async () => {
      if (prisma === undefined) {
        return;
      }
      // RLS-compliant cleanup (children first, inside tenant transactions).
      for (const [orgId, userId] of [
        [ORG_A, USER_A],
        [ORG_B, USER_B],
      ] as const) {
        await withGucContext(
          { organizationId: orgId, userId },
          async (tx) => {
            await tx.business.deleteMany({ where: { organizationId: orgId } });
            await tx.organizationMember.deleteMany({ where: { organizationId: orgId } });
            await tx.organization.deleteMany({ where: { id: orgId } });
          },
          prisma,
        );
      }
      await prisma.user.deleteMany({ where: { id: { in: [USER_A, USER_B] } } });
      await prisma.$disconnect();
    });

    it("A. Tenant A can see Tenant A rows", async () => {
      const rows = await withTenantTransaction(
        tenant(ORG_A, USER_A),
        (tx) => tx.business.findMany({ where: { organizationId: ORG_A } }),
        prisma,
      );
      expect(rows.length).toBe(1);
      const org = await withTenantTransaction(
        tenant(ORG_A, USER_A),
        (tx) => tx.organization.findUnique({ where: { id: ORG_A } }),
        prisma,
      );
      expect(org?.id).toBe(ORG_A);
    });

    it("B. Tenant A cannot see Tenant B rows", async () => {
      const rows = await withTenantTransaction(
        tenant(ORG_A, USER_A),
        (tx) => tx.business.findMany({ where: { organizationId: ORG_B } }),
        prisma,
      );
      expect(rows.length).toBe(0);
    });

    it("C. Tenant B cannot see Tenant A rows", async () => {
      const rows = await withTenantTransaction(
        tenant(ORG_B, USER_B),
        (tx) => tx.business.findMany({ where: { organizationId: ORG_A } }),
        prisma,
      );
      expect(rows.length).toBe(0);
    });

    it("D. No app.org_id → no tenant rows exposed (fail closed)", async () => {
      const rows = await prisma.business.findMany();
      expect(rows.length).toBe(0);
    });

    it("E. UPDATE cannot move a row to another tenant (WITH CHECK)", async () => {
      await expect(
        withTenantTransaction(
          tenant(ORG_A, USER_A),
          (tx) =>
            tx.business.updateMany({
              where: { organizationId: ORG_A },
              data: { organizationId: ORG_B },
            }),
          prisma,
        ),
      ).rejects.toThrow();
    });

    it("F. DELETE cannot remove another tenant's row", async () => {
      const result = await withTenantTransaction(
        tenant(ORG_A, USER_A),
        (tx) => tx.business.deleteMany({ where: { id: ORG_B } }),
        prisma,
      );
      expect(result.count).toBe(0);
    });

    it("G. ENABLE + FORCE ROW LEVEL SECURITY are active on all seven tenant tables", async () => {
      const catalog = await prisma.$queryRaw<
        Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >`SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname IN ('organizations','organization_members','businesses','websites','monitoring_checks','monitoring_results','issues')`;
      expect(catalog.length).toBe(7);
      for (const table of catalog) {
        expect(table.relrowsecurity, `${table.relname} RLS enabled`).toBe(true);
        expect(table.relforcerowsecurity, `${table.relname} RLS forced`).toBe(true);
      }
    });

    it("H. Transaction-local GUC does not leak after the transaction", async () => {
      await withTenantTransaction(tenant(ORG_A, USER_A), async () => undefined, prisma);
      const rows = await prisma.business.findMany({ where: { organizationId: ORG_A } });
      expect(rows.length).toBe(0);
    });
  },
);

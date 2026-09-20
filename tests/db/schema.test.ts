import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { IssueSeverity, IssueStatus, MemberRole, MonitorType, Prisma } from "@prisma/client";

/**
 * Phase 1B-04 domain-schema tests — fully offline (no live database).
 * Verified against Prisma metadata (dmmf) and the schema/migration sources.
 * All URLs/credentials anywhere in this file are test dummies.
 */

const MIGRATION_DIR = "db/migrations/20260824140000_init_domain";
const DISPATCH_MIGRATION = "db/migrations/20260905100000_tenant_dispatch/migration.sql";
const HEALTH_SCORE_MIGRATION = "db/migrations/20260911120000_health_score/migration.sql";
const HEALTH_SCORE_GRANTS_MIGRATION =
  "db/migrations/20260911123000_health_score_runtime_grants/migration.sql";

const modelNames = (): string[] => Prisma.dmmf.datamodel.models.map((model) => model.name);
const fieldNames = (model: string): string[] =>
  (Prisma.dmmf.datamodel.models.find((candidate) => candidate.name === model)?.fields ?? []).map(
    (field) => field.name,
  );

describe("prisma schema validity", () => {
  it("validates cleanly (offline, dummy envs)", () => {
    const output = execFileSync(
      process.execPath,
      ["node_modules/prisma/build/index.js", "validate", "--schema", "db/schema.prisma"],
      {
        encoding: "utf8",
        timeout: 60_000,
        env: {
          ...process.env,
          DATABASE_URL: "postgresql://u:p@localhost:5432/guardian",
          DIRECT_URL: "postgresql://u:p@localhost:5432/guardian",
        },
      },
    );

    expect(output).toContain("is valid");
  }, 30_000);
});

describe("required models", () => {
  it("implements the approved tenant chain", () => {
    for (const model of [
      "User",
      "Organization",
      "OrganizationMember",
      "Business",
      "Website",
      "Monitor",
      "MonitoringResult",
      "Issue",
      "HealthScore",
      "HealthScoreComponent",
    ]) {
      expect(modelNames()).toContain(model);
    }
  });

  it("maps Monitor to the approved Phase 1A table name", () => {
    const source = readFileSync("db/schema.prisma", "utf8");
    expect(source).toContain('@@map("monitoring_checks")');
  });
});

describe("required enums (approved vocabulary, exact values)", () => {
  it("MemberRole matches the RBAC roles", () => {
    expect(MemberRole.OWNER).toBe("OWNER");
    expect(MemberRole.ADMIN).toBe("ADMIN");
    expect(MemberRole.MEMBER).toBe("MEMBER");
    expect(MemberRole.VIEWER).toBe("VIEWER");
  });

  it("IssueSeverity and IssueStatus match the issue engine vocabulary", () => {
    expect(IssueSeverity.CRITICAL).toBe("CRITICAL");
    expect(IssueSeverity.INFO).toBe("INFO");
    expect(IssueStatus.OPEN).toBe("OPEN");
    expect(IssueStatus.ACKNOWLEDGED).toBe("ACKNOWLEDGED");
    expect(IssueStatus.IN_PROGRESS).toBe("IN_PROGRESS");
    expect(IssueStatus.RESOLVED).toBe("RESOLVED");
    expect(IssueStatus.IGNORED).toBe("IGNORED");
  });

  it("MonitorType matches the approved check types", () => {
    for (const type of [
      "UPTIME",
      "SSL",
      "SECURITY",
      "SEO",
      "CONTENT",
      "LINKS",
      "PERFORMANCE",
      "FORM",
    ] as const) {
      expect(MonitorType[type]).toBe(type);
    }
  });

  it("HealthScore categories and states match the PRD contract", () => {
    expect(
      Prisma.dmmf.datamodel.enums
        .find((item) => item.name === "HealthScoreCategory")
        ?.values.map((item) => item.name),
    ).toEqual(["WEBSITE", "LEAD_GENERATION", "PERFORMANCE", "SEO", "SECURITY", "REPUTATION"]);
    expect(
      Prisma.dmmf.datamodel.enums
        .find((item) => item.name === "HealthScoreState")
        ?.values.map((item) => item.name),
    ).toEqual(["MEASURED", "PARTIAL", "INSUFFICIENT_DATA"]);
  });
});

describe("tenant isolation ownership", () => {
  it("every tenant-owned model carries a required organizationId", () => {
    for (const model of [
      "OrganizationMember",
      "Business",
      "Website",
      "Monitor",
      "MonitoringResult",
      "Issue",
      "HealthScore",
      "HealthScoreComponent",
    ]) {
      expect(fieldNames(model)).toContain("organizationId");
    }
  });

  it("Issue and Monitor anchor to their Website; Website anchors to Business", () => {
    expect(fieldNames("Issue")).toContain("websiteId");
    expect(fieldNames("Monitor")).toContain("websiteId");
    expect(fieldNames("MonitoringResult")).toContain("monitorId");
    expect(fieldNames("Website")).toContain("businessId");
  });
});

describe("critical unique constraints and indexes", () => {
  const schema = readFileSync("db/schema.prisma", "utf8");

  it("enforces membership uniqueness per organization", () => {
    expect(schema).toContain("@@unique([organizationId, userId])");
  });

  it("enforces website uniqueness per organization hostname", () => {
    expect(schema).toContain("@@unique([organizationId, hostname])");
  });

  it("enforces one monitor per (website, type)", () => {
    expect(schema).toContain("@@unique([websiteId, type])");
  });

  it("enforces issue fingerprint deduplication", () => {
    expect(schema).toMatch(/fingerprint\s+String\s+@unique/);
  });

  it("supports the issue queue and scheduler access patterns", () => {
    expect(schema).toContain("@@index([organizationId, status, severity])");
    expect(schema).toContain("@@index([nextRunAt])");
  });

  it("keeps score snapshots and components tenant-scoped with bounded history indexes", () => {
    const migration = readFileSync(HEALTH_SCORE_MIGRATION, "utf8");
    const grantsMigration = readFileSync(HEALTH_SCORE_GRANTS_MIGRATION, "utf8");
    expect(migration).toContain('CREATE TABLE "health_scores"');
    expect(migration).toContain('CREATE TABLE "health_score_components"');
    expect(migration).toContain('ALTER TABLE "health_scores" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "health_score_components" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain('"health_scores_organizationId_calculatedAt_idx"');
    expect(migration).toContain('"health_score_components_organizationId_calculatedAt_idx"');
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_scores" TO guardian_app',
    );
    expect(migration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_score_components" TO guardian_app',
    );
    expect(grantsMigration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_scores" TO guardian_app',
    );
    expect(grantsMigration).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_score_components" TO guardian_app',
    );
  });
});

describe("security posture", () => {
  it("User is an identity mirror — no password or secret fields", () => {
    const userFields = fieldNames("User");
    for (const forbidden of ["password", "passwordHash", "secret", "token", "apiKey"]) {
      expect(userFields).not.toContain(forbidden);
    }
  });

  it("schema and migration contain no connection strings", () => {
    const migration = readFileSync(`${MIGRATION_DIR}/migration.sql`, "utf8");
    for (const source of [readFileSync("db/schema.prisma", "utf8"), migration]) {
      expect(source).not.toMatch(/postgres(ql)?:\/\/[^\s"]+:[^\s"]+@/);
    }
  });
});

describe("first versioned migration", () => {
  it("exists with a lock file", () => {
    expect(existsSync(`${MIGRATION_DIR}/migration.sql`)).toBe(true);
    expect(existsSync("db/migrations/migration_lock.toml")).toBe(true);
  });

  it("creates all seven approved tables", () => {
    const migration = readFileSync(`${MIGRATION_DIR}/migration.sql`, "utf8");
    for (const table of [
      "users",
      "organizations",
      "organization_members",
      "businesses",
      "websites",
      "monitoring_checks",
      "issues",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
  });
});

describe("system-owned tenant dispatch", () => {
  const migration = readFileSync(DISPATCH_MIGRATION, "utf8");

  it("stores monitor and SLA routing metadata outside tenant-owned tables", () => {
    expect(migration).toContain('CREATE TABLE "guardian_jobs"."monitor_dispatch"');
    expect(migration).toContain('CREATE TABLE "guardian_jobs"."sla_dispatch"');
    expect(migration).toContain('CREATE INDEX "monitor_dispatch_due_idx"');
    expect(migration).toContain('CREATE INDEX "sla_dispatch_due_idx"');
    expect(migration).toContain('FROM "monitoring_checks" AS m');
    expect(migration).toContain('FROM "issues" AS i');
  });

  it("does not create a privileged RLS bypass or reset production credentials", () => {
    expect(migration).not.toMatch(/BYPASSRLS/i);
    expect(migration).not.toMatch(/CREATE ROLE/i);
    expect(migration).not.toMatch(/PASSWORD\s+'[^']+'/i);
  });
});

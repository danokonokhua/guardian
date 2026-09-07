-- Tenant dispatch registry (Phase 1B production worker hardening)
--
-- The worker must discover due work without reading tenant-owned tables outside
-- an organization GUC transaction. These private, system-owned rows are only
-- routing metadata; the worker still loads and mutates tenant data inside
-- withGucContext before executing any tenant operation.

CREATE SCHEMA IF NOT EXISTS "guardian_jobs";

CREATE TABLE "guardian_jobs"."monitor_dispatch" (
  "monitor_id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "website_id" TEXT NOT NULL,
  "monitor_type" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "frequency_minutes" INTEGER NOT NULL CHECK ("frequency_minutes" >= 1),
  "next_run_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "monitor_dispatch_due_idx"
  ON "guardian_jobs"."monitor_dispatch" ("next_run_at")
  WHERE "enabled" = TRUE;

CREATE TABLE "guardian_jobs"."sla_dispatch" (
  "organization_id" TEXT PRIMARY KEY,
  "frequency_minutes" INTEGER NOT NULL DEFAULT 5 CHECK ("frequency_minutes" >= 1),
  "next_run_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "sla_dispatch_due_idx"
  ON "guardian_jobs"."sla_dispatch" ("next_run_at");

-- Seed dispatch rows for installations that already have monitors/incidents.
-- On a direct migration connection this preserves the existing
-- schedule. If a restricted migration role is used, RLS may return zero rows;
-- the deployment smoke test must then run one check per existing monitor.
INSERT INTO "guardian_jobs"."monitor_dispatch"
  ("monitor_id", "organization_id", "website_id", "monitor_type", "enabled", "frequency_minutes", "next_run_at", "updated_at")
SELECT
  m."id",
  m."organizationId",
  m."websiteId",
  m."type"::text,
  m."enabled",
  m."frequencyMinutes",
  COALESCE(m."nextRunAt", CURRENT_TIMESTAMP),
  CURRENT_TIMESTAMP
FROM "monitoring_checks" AS m
JOIN "websites" AS w ON w."id" = m."websiteId"
WHERE m."enabled" = TRUE
  AND w."verifyStatus" = 'VERIFIED'
  AND w."deletedAt" IS NULL
ON CONFLICT ("monitor_id") DO NOTHING;

INSERT INTO "guardian_jobs"."sla_dispatch"
  ("organization_id", "next_run_at", "updated_at")
SELECT DISTINCT
  i."organizationId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "issues" AS i
JOIN "organizations" AS o ON o."id" = i."organizationId"
WHERE i."status"::text NOT IN ('RESOLVED', 'IGNORED')
  AND o."deletedAt" IS NULL
ON CONFLICT ("organization_id") DO NOTHING;

-- Dispatch metadata is never exposed through the public/data API schema.
REVOKE ALL ON TABLE
  "guardian_jobs"."monitor_dispatch",
  "guardian_jobs"."sla_dispatch"
FROM PUBLIC;

-- Local integration fixtures may define guardian_app. Production deployments
-- keep ownership with the configured Prisma connection role and do not create
-- or reset credentials in a migration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE
      ON TABLE "guardian_jobs"."monitor_dispatch", "guardian_jobs"."sla_dispatch"
      TO guardian_app;
  END IF;
END
$$;

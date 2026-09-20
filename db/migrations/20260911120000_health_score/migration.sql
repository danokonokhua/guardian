-- Durable Digital Health Score snapshots and explainable category components.
--
-- Scores are tenant-owned history.  Components retain bounded counts and
-- identifiers only; page bodies, credentials, and raw response payloads are
-- never stored here.  The application writes both tables inside a
-- transaction-local app.org_id context.

CREATE TYPE "HealthScoreCategory" AS ENUM (
  'WEBSITE',
  'LEAD_GENERATION',
  'PERFORMANCE',
  'SEO',
  'SECURITY',
  'REPUTATION'
);

CREATE TYPE "HealthScoreState" AS ENUM (
  'MEASURED',
  'PARTIAL',
  'INSUFFICIENT_DATA'
);

CREATE TYPE "HealthScoreComponentState" AS ENUM (
  'MEASURED',
  'PENDING'
);

CREATE TABLE "health_scores" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "score" INTEGER,
  "state" "HealthScoreState" NOT NULL,
  "coverageWeight" INTEGER NOT NULL DEFAULT 0,
  "sourceVersion" TEXT NOT NULL DEFAULT 'v1',
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "health_scores_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "health_scores_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  CONSTRAINT "health_scores_coverage_check" CHECK ("coverageWeight" >= 0 AND "coverageWeight" <= 100),
  CONSTRAINT "health_scores_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "health_score_components" (
  "id" TEXT NOT NULL,
  "healthScoreId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "category" "HealthScoreCategory" NOT NULL,
  "weight" INTEGER NOT NULL,
  "score" INTEGER,
  "state" "HealthScoreComponentState" NOT NULL,
  "monitorCount" INTEGER NOT NULL DEFAULT 0,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "upCount" INTEGER NOT NULL DEFAULT 0,
  "downCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "explanation" TEXT NOT NULL,
  "evidence" JSONB NOT NULL DEFAULT '{}',
  "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "health_score_components_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "health_score_components_score_check" CHECK ("score" IS NULL OR ("score" >= 0 AND "score" <= 100)),
  CONSTRAINT "health_score_components_weight_check" CHECK ("weight" > 0 AND "weight" <= 100),
  CONSTRAINT "health_score_components_counts_check" CHECK (
    "monitorCount" >= 0 AND "resultCount" >= 0 AND "upCount" >= 0 AND
    "downCount" >= 0 AND "errorCount" >= 0
  ),
  CONSTRAINT "health_score_components_healthScoreId_fkey"
    FOREIGN KEY ("healthScoreId") REFERENCES "health_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "health_score_components_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "health_score_components_healthScoreId_category_key"
  ON "health_score_components"("healthScoreId", "category");
CREATE INDEX "health_scores_organizationId_calculatedAt_idx"
  ON "health_scores"("organizationId", "calculatedAt");
CREATE INDEX "health_score_components_organizationId_calculatedAt_idx"
  ON "health_score_components"("organizationId", "calculatedAt");

-- The baseline grant migration ran before these tables existed.  Grant the
-- least-privilege runtime role access explicitly so production workers and
-- web requests can read/write scores without requiring a superuser.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'guardian_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_scores" TO guardian_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "health_score_components" TO guardian_app;
  END IF;
END
$$;

ALTER TABLE "health_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health_scores" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_health_scores" ON "health_scores"
  FOR SELECT USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_insert_health_scores" ON "health_scores"
  FOR INSERT WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_update_health_scores" ON "health_scores"
  FOR UPDATE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_delete_health_scores" ON "health_scores"
  FOR DELETE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

ALTER TABLE "health_score_components" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health_score_components" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_health_score_components" ON "health_score_components"
  FOR SELECT USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_insert_health_score_components" ON "health_score_components"
  FOR INSERT WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_update_health_score_components" ON "health_score_components"
  FOR UPDATE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);
CREATE POLICY "tenant_delete_health_score_components" ON "health_score_components"
  FOR DELETE USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

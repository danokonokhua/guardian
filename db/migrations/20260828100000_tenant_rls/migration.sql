-- Guardian tenant Row Level Security (Phase 1B-07)
--
-- The database is the FINAL tenant-isolation backstop (defense in depth behind
-- the application-layer authorization in lib/auth). This migration enables and
-- FORCEs RLS on every tenant-owned table and installs deny-by-default,
-- organization-bound policies keyed on the transaction-local GUC set by
-- db/tenant.ts (withTenantTransaction / withGucContext):
--
--   app.org_id  — uuid of the active tenant
--   app.user_id — uuid of the acting user
--
-- Fail-closed design:
-- - NULLIF(current_setting('app.org_id', true), '')::text yields NULL when the
--   GUC is absent or empty, and `organization_id = NULL` evaluates to NULL
--   (not TRUE), so no policy authorizes anything outside an explicit tenant
--   transaction. A non-UUID GUC value raises a cast error, which is also
--   fail-closed.
-- - ENABLE + FORCE ROW LEVEL SECURITY: FORCE is mandatory — without it the
--   table owner (the role Prisma connects as) would bypass RLS entirely.
-- - No service-role bypasses, no SECURITY DEFINER, no USING (true)/WITH CHECK
--   (true) policies.
--
-- Documented exception (SELECT-only): organization_members additionally allows
-- a user to SELECT their OWN membership rows via app.user_id. This is required
-- for authorization bootstrap (resolving "which organizations am I in?") and
-- cannot bypass organization isolation: writes remain organization-bound, and
-- it never exposes another user's rows or any other tenant's data.
--
-- NOT LIVE-APPLIED: created offline; no PostgreSQL database exists in the
-- development sandbox. Apply with `npm run db:deploy` (see docs/TENANCY.md).

-- ---------------------------------------------------------------------------
-- organizations (tenant root; the tenant key is the row's own id)
-- ---------------------------------------------------------------------------

ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_organizations" ON "organizations"
  FOR SELECT
  USING ("id" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_insert_organizations" ON "organizations"
  FOR INSERT
  WITH CHECK ("id" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_update_organizations" ON "organizations"
  FOR UPDATE
  USING ("id" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("id" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_delete_organizations" ON "organizations"
  FOR DELETE
  USING ("id" = NULLIF(current_setting('app.org_id', true), '')::text);

-- ---------------------------------------------------------------------------
-- organization_members (org-bound all operations + documented self-SELECT)
-- ---------------------------------------------------------------------------

ALTER TABLE "organization_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_members" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_organization_members" ON "organization_members"
  FOR SELECT
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "self_select_organization_members" ON "organization_members"
  FOR SELECT
  USING ("userId" = NULLIF(current_setting('app.user_id', true), '')::text);

CREATE POLICY "tenant_insert_organization_members" ON "organization_members"
  FOR INSERT
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_update_organization_members" ON "organization_members"
  FOR UPDATE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_delete_organization_members" ON "organization_members"
  FOR DELETE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

-- ---------------------------------------------------------------------------
-- businesses
-- ---------------------------------------------------------------------------

ALTER TABLE "businesses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "businesses" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_businesses" ON "businesses"
  FOR SELECT
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_insert_businesses" ON "businesses"
  FOR INSERT
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_update_businesses" ON "businesses"
  FOR UPDATE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_delete_businesses" ON "businesses"
  FOR DELETE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

-- ---------------------------------------------------------------------------
-- websites
-- ---------------------------------------------------------------------------

ALTER TABLE "websites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "websites" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_websites" ON "websites"
  FOR SELECT
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_insert_websites" ON "websites"
  FOR INSERT
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_update_websites" ON "websites"
  FOR UPDATE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_delete_websites" ON "websites"
  FOR DELETE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

-- ---------------------------------------------------------------------------
-- monitoring_checks (Monitor model)
-- ---------------------------------------------------------------------------

ALTER TABLE "monitoring_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "monitoring_checks" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_monitoring_checks" ON "monitoring_checks"
  FOR SELECT
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_insert_monitoring_checks" ON "monitoring_checks"
  FOR INSERT
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_update_monitoring_checks" ON "monitoring_checks"
  FOR UPDATE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_delete_monitoring_checks" ON "monitoring_checks"
  FOR DELETE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

-- ---------------------------------------------------------------------------
-- issues
-- ---------------------------------------------------------------------------

ALTER TABLE "issues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "issues" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_issues" ON "issues"
  FOR SELECT
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_insert_issues" ON "issues"
  FOR INSERT
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_update_issues" ON "issues"
  FOR UPDATE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text)
  WITH CHECK ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

CREATE POLICY "tenant_delete_issues" ON "issues"
  FOR DELETE
  USING ("organizationId" = NULLIF(current_setting('app.org_id', true), '')::text);

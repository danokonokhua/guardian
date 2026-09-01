# Guardian — Tenancy, RBAC & Database Isolation (Phase 1B-07)

## Isolation architecture

```
application authorization (lib/auth — primary)
        ↓  TenantScope (explicit, serializable)
tenant-scoped transaction (db/tenant.ts)
        ↓  set_config('app.org_id' | 'app.user_id', $1, true)  — transaction-LOCAL
PostgreSQL RLS (ENABLE + FORCE — final backstop)
```

## 1. TenantScope

`db/tenant.ts` — `{ organizationId, userId, role }`, frozen, plain-data
serializable. Built ONLY from an authorized `OrganizationContext` via
`createTenantScope` (the Phase 1B-05 boundary re-trusts nothing). This exact
shape is what future background jobs will carry in their payloads — no
AsyncLocalStorage, no process-global mutable tenant state (deliberately).

## 2–4. Authentication / membership / permission authority

- Identity: exclusively the `AuthAdapter` seam (still anonymous-fail-closed;
  Supabase wiring is a later phase).
- Membership/role: exclusively the identity repository (database-authoritative).
- Permissions: `lib/auth/permissions.ts` — the static, immutable Phase 1A §10
  matrix (24 permission strings × OWNER/ADMIN/MEMBER/VIEWER). ADMIN lacks
  `org:delete` by invariant; `member:manage` by documented convention never
  permits creating/promoting/demoting/deleting OWNERs. `can()` is
  deny-by-default for unknown roles, unknown permissions, null/undefined.

## 5–7. requirePermission and the 404-before-403 rule

`lib/auth/context.ts#requirePermission(organizationId, permission)`:
membership resolves FIRST — non-members and INVITED/REVOKED members get
**404 NOT_FOUND** (existence masking) — and only then is the permission map
consulted (**403 FORBIDDEN**). A permission request can therefore never
reveal whether an organization exists. Client-supplied userId/organizationId/
role/email are never trusted.

## 8–10. withTenantTransaction & GUC design

`withTenantTransaction(scope, callback)` opens a Prisma transaction, sets
`app.org_id` and `app.user_id` via `SELECT set_config(name, $1, true)` —
parameterized tagged-template SQL, `true` = transaction-LOCAL (never
session/global) — and hands the callback ONLY the transaction-scoped client.
`withGucContext` is the lower-level bootstrap helper used by the identity
repository (membership reads must work under FORCE RLS before a full
TenantScope exists). **Dynamic SQL is forbidden**: tenant IDs are always
parameters, never concatenated — string-built SQL would be an injection
vector and a review-blocking violation.

## 11–12. RLS design & FORCE

Migration `20260828100000_tenant_rls` covers the six tenant-owned tables
(`organizations`, `organization_members`, `businesses`, `websites`,
`monitoring_checks`, `issues`) — table names verified against the schema's
`@@map` (Monitor → `monitoring_checks`). Every table gets
`ENABLE ROW LEVEL SECURITY` **and** `FORCE ROW LEVEL SECURITY` (FORCE is
mandatory: without it the table owner — the role Prisma connects as —
bypasses RLS). Policies are organization-bound for SELECT/INSERT/UPDATE/DELETE
with `USING` + `WITH CHECK`; `organizations` keys on its own `id`. Absent
GUC → `NULLIF(current_setting(...,''), '')::uuid` is NULL → policy evaluates
NULL → denied (fail-closed). Documented sole exception: a SELECT-only
self-membership policy on `organization_members` via `app.user_id`
(authorization bootstrap: a user may enumerate their OWN memberships; it can
never read another user's rows, never writes, never crosses tenants).

## 13. How tenant-owned queries must execute

Route → `requirePermission`/`requireRole` → `createTenantScope(context)` →
service function → `withTenantTransaction(scope, tx => …)` → Prisma.
See `services/organizations/repository.ts` for the sanctioned pattern.
Queries outside a tenant transaction see zero tenant rows once RLS is live.

## 15. Enabling RLS integration tests

Point `TEST_DATABASE_URL` at a THROWAWAY PostgreSQL database (never
production) — `tests/db/rls.integration.test.ts` then applies all migrations
and verifies: tenant A/B visibility, unscoped denial, cross-tenant
UPDATE/DELETE blocking, ENABLE+FORCE active on all six tables, and GUC
non-leakage. Without the variable the suite skips cleanly.

## 16. Why no live migration execution occurred here

The development sandbox provides no PostgreSQL server. The RLS migration was
created offline, statically reviewed, and committed — it has NOT been applied
to any database in this environment. Apply with `npm run db:deploy` when a
database is provisioned (dev first), and run the gated integration suite.

## 17. Deferred

Supabase Auth wiring / sessions · AsyncLocalStorage request-scoped tenancy ·
pg-boss (jobs will carry the serializable TenantScope) · provision-time role
topology review (e.g. dedicated non-owner app role) · RLS for future tables ·
product endpoints.

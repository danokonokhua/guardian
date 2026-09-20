# Guardian — Database Foundation (Phase 1B-03) + Domain Schema (Phase 1B-04)

Approved architecture: **self-hosted PostgreSQL + Prisma + Prisma Migrate**.
The PRD permits an equivalent provider; this deployment runs PostgreSQL in
Docker on the VPS.

## Domain models (Phase 1B-04)

Approved tenant chain implemented with Phase 1A field specifications:

```
User (identity mirror, no auth secrets)
Organization (tenant root) ── OrganizationMember (OWNER|ADMIN|MEMBER|VIEWER)
  └─ Business ── Website ──┬─ Monitor  (table: monitoring_checks; one per type/website)
                           └─ Issue    (fingerprint-deduped lifecycle)
Organization ── HealthScore snapshot ── HealthScoreComponent (six PRD categories; tenant-scoped)
```

Implemented engine tables include `monitoring_results`, `issue_events`,
`health_scores`/`health_score_components`, and notification tables. Grounded
recommendations v1 are a tenant-scoped read projection over existing issue and
score data and therefore require no table or migration. Persistent
recommendation lifecycle records and audit logs remain deferred to later engine
phases.

## Migrations

- `20260824140000_init_domain` — initial domain schema (7 tables, 17 indexes,
  citext extension for the case-insensitive unique email). Created OFFLINE via
  the documented `prisma migrate diff --from-empty --to-schema-datamodel`
  workflow and verified deterministic across regenerations.
- `20260907160000_local_auth` — PostgreSQL-backed credentials, opaque sessions,
  and single-use password-reset tokens for self-hosted deployments.
- `20260911120000_health_score` — PRD-weighted Digital Health Score v1 snapshots
  and explainable category components. Both tables are tenant-scoped with
  `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`; score snapshots
  retain bounded evidence and issue-driver references, not page bodies or raw
  response data.
- `20260911123000_health_score_runtime_grants` — idempotently grants the
  least-privilege `guardian_app` runtime role access to score snapshots and
  components for databases that already applied the table migration.
- **Live execution status:** the Docker Compose `postgres` service is the
  development and production database. The one-shot `migrate` service applies
  Prisma and pg-boss migrations with the admin role before web and worker start.

## Layout

| Path               | Purpose                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------- |
| `db/schema.prisma` | Single source of truth for the database (datasource, generator, and approved domain models)  |
| `db/migrations/`   | Version-controlled, ordered Prisma migrations, including the health-score snapshot migration |
| `db/client.ts`     | Server-only Prisma client: lazy instantiation, hot-reload-safe global caching                |
| `db/health.ts`     | Time-boxed, sanitized readiness probe (`SELECT 1`)                                           |

## Connection variables (server-only — never `NEXT_PUBLIC_*`)

| Variable       | Used by                                   | Purpose                                                                 |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL` | Prisma client and pg-boss runtime queries | Derived Compose connection at `postgres:5432` using `POSTGRES_APP_USER` |
| `DIRECT_URL`   | Prisma Migrate (CLI only)                 | Derived Compose connection at `postgres:5432` using `POSTGRES_USER`     |

Both are validated (PostgreSQL URL format) by `config/env.ts` when present.
Neither is ever hardcoded, committed, or returned by an API.

## Workflow

```bash
# 1. Configure environment (local example — never commit real values)
cp .env.example .env
#   DATABASE_URL=postgresql://...   (pooled)
#   DIRECT_URL=postgresql://...     (direct, for migrations)

# 2. Regenerate the typed client after any schema change
npm run db:generate

# 3. Create/apply a migration in development (uses DIRECT_URL + shadow db)
npm run db:migrate -- --name <descriptive_name>

# 4. Apply pending migrations in CI/production (deterministic, ordered)
npm run db:deploy

# 5. Inspect migration state
npm run db:status
```

Rules:

- Migrations are deterministic, ordered, and version-controlled; they must run
  cleanly against an empty database (`npm run db:deploy` on a fresh database).
- Migrations must contain **no credentials and no environment-specific
  values** — connection strings live only in the environment.
- `npm ci` (and any install) regenerates the client automatically via the
  `postinstall` script — `prisma generate` is fully offline and needs **no**
  environment variables (CI-safe).
- CLI commands that resolve the datasource (`validate`, `migrate`, `status`,
  `deploy`) require `DATABASE_URL`/`DIRECT_URL` to be present in the
  environment. For offline schema validation, dummy placeholders are fine:

  ```bash
  DATABASE_URL="postgresql://u:p@localhost:5432/guardian" \
  DIRECT_URL="postgresql://u:p@localhost:5432/guardian" \
    npx prisma validate --schema db/schema.prisma
  ```

## Health / readiness

- `GET /api/health` — cheap application liveness (unchanged; touches nothing).
- `GET /api/health/ready` — application + database readiness. Returns coarse
  statuses only (`healthy` / `unconfigured` / `unhealthy`); 503 when a
  _configured_ database is unreachable. Never exposes hosts, connection
  strings, or raw database errors; diagnostics go to the server-side logger.

## Testing

Database unit tests run without a live database (`tests/db/`), including schema
and migration/RLS catalog assertions. `tests/db/rls.integration.test.ts` is
gated by `TEST_DATABASE_URL`; when enabled it applies all migrations and checks
tenant isolation plus `ENABLE + FORCE ROW LEVEL SECURITY` on the nine tenant
tables, including both health-score tables. The scorer and health repository
also have deterministic unit coverage without external services.

## Phase 1B-09 job storage

Guardian background jobs use pg-boss in the dedicated PostgreSQL schema `guardian_jobs`.
The schema is intentionally outside the tenant RLS model because these are infrastructure
records rather than tenant-owned application data. The Compose `migrate` service runs pg-boss
schema migrations once with `DIRECT_URL`/the admin role; the worker uses only
`DATABASE_URL` and never performs database-level DDL at startup.

The long-running worker is started with `npm run worker` and refuses to start if
the runtime role is a PostgreSQL superuser or has `BYPASSRLS`. The guarded `POST /api/cron/tick`
endpoint requires `Authorization: Bearer <CRON_SECRET>` and only enqueues the singleton
`system.ping` foundation job; the worker performs the actual processing.

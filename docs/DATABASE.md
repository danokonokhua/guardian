# Guardian — Database Foundation (Phase 1B-03)

Approved architecture: **PostgreSQL (Supabase-hosted) + Prisma + Prisma Migrate**
(Phase 1A, ADR-001/ADR-002). This phase establishes infrastructure only; domain
models (organizations, businesses, websites, monitoring, issues, …) arrive in
Phase 1B-04 per the approved MVP schema and are deliberately not invented here.

## Layout

| Path               | Purpose                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `db/schema.prisma` | Single source of truth for the database (datasource + generator; models arrive in 1B-04)                            |
| `db/migrations/`   | Version-controlled migrations (created by `prisma migrate dev`; first migration lands with the first domain models) |
| `db/client.ts`     | Server-only Prisma client: lazy instantiation, hot-reload-safe global caching                                       |
| `db/health.ts`     | Time-boxed, sanitized readiness probe (`SELECT 1`)                                                                  |

## Connection variables (server-only — never `NEXT_PUBLIC_*`)

| Variable       | Used by                         | Purpose                                               |
| -------------- | ------------------------------- | ----------------------------------------------------- |
| `DATABASE_URL` | Prisma client (runtime queries) | Pooled connection (Supabase pooler / PgBouncer-style) |
| `DIRECT_URL`   | Prisma Migrate (CLI only)       | Direct, non-pooled connection for migrations          |

Both are validated (PostgreSQL URL format) by `config/env.ts` when present and
remain optional until Phase 1B-04. Neither is ever hardcoded, committed, or
returned by an API.

## Workflow

```bash
# 1. Configure environment (local example — never commit real values)
cp .env.example .env.local
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

Database unit tests run against **no live database** (`tests/db/`):
unconfigured behavior, unreachable-database sanitization, singleton/hot-reload
semantics, and secret non-disclosure. A live-database integration suite
becomes relevant with Phase 1B-04 domain models and will be isolated and
documented there.

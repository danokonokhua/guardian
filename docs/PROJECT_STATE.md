# Guardian — Project State

**Last updated:** 2026-08-24 (Phase 1B-05 identity/auth foundation)

## Current phase

**1B-05 — Authentication & Authorization Foundation: COMPLETE.** Identity
abstraction, auth-adapter boundary (anonymous fail-closed default; Supabase
wiring deferred), deny-by-default role checks (OWNER>ADMIN>MEMBER>VIEWER),
tenant context (frozen, mismatch-proof), and Prisma identity/membership
lookups. See `docs/AUTH.md`. No database/schema changes, no new dependencies.
Decision semantics: 401 unauthenticated, 404 non-member (existence masking),
403 insufficient role, 500 tenant-context invariant.

## Next approved phase

PHASE 1B-06 (not started) — recommended: API foundation / request wiring of
the identity context, per the approved 1A sequence.

## History

**1B-04 — Domain Database Schema: COMPLETE** (commit 8f8c3a4; 7 tables, 17
indexes, migration `20260824140000_init_domain` created offline; live DB
execution blocked — no database configured in sandbox; apply later via
`npm run db:deploy`).

## Phase 1B-03 summary

- Prisma 6.19.2 pair (`@prisma/client` runtime / `prisma` dev-only). Prisma 7
  was evaluated and set aside: it removes schema-level connection config and
  mandates driver adapters — a larger footprint than the approved 1A pattern.
- `db/schema.prisma` (datasource + generator only — NO domain models invented;
  they arrive in Phase 1B-04), `db/client.ts` (server-only, lazy, hot-reload
  safe), `db/health.ts` (time-boxed sanitized probe), `GET /api/health/ready`
  (application + database readiness; 503 only when a configured DB is down).
- Scripts: `db:generate` / `db:migrate` / `db:deploy` / `db:status` +
  `postinstall` generate (offline, CI-safe). Workflow documented in
  `docs/DATABASE.md`.
- Environment fix: npm cache moved `/tmp` → `/var/tmp` (tmpfs cache caused
  npm-ci OOM on the 2 GB sandbox; disk-backed cache fixed it — full `npm ci`
  now passes in ~21 s including client generation).
- Tests: 51 (40 preserved + 11 database-foundation tests), no live DB required.

## History

**1B-01 — Project Repository & Application Foundation: COMPLETE.**

No later-phase work (auth, database, RBAC, pg-boss, monitoring, dashboard, AI) has been
started, per the phase gate.

## Completed work

- Next.js 16.3.2 application (App Router, no Pages Router), React 19.2.8, TypeScript 6
  (strict + `noUncheckedIndexedAccess`, `noImplicitOverride`, …).
- Tailwind CSS v4 pipeline (`@tailwindcss/postcss`) with a minimal landing page
  ("Guardian — Phase 1B Foundation — Status: Operational").
- ESLint 9 flat config using the **native** `eslint-config-next@16` flat exports, plus a
  repository-wide `no-console` error rule (the logger is the only sanctioned consumer).
- Prettier 3 conventions (`.prettierrc`, `.prettierignore`); whole repo formatted.
- Centralized environment configuration (`config/env.ts`) — the only `process.env` reader
  (sanctioned exception: `next.config.ts` for Next-managed `NODE_ENV`). Fail-fast
  validation; currently consumes `LOG_LEVEL` and `APP_ENV` only.
- `.env.example` documenting active variables and reserved future variables; `.gitignore`
  protects all `.env*` (except the example), keys, and build artifacts.
- Structured JSON logging foundation (`lib/logger.ts`): levels, child loggers, sensitive-key
  redaction, error serialization — no external provider (deliberate).
- Error-handling foundation (`lib/errors.ts`, `lib/api.ts`): `AppError` taxonomy, canonical
  API error envelope `{ error: { code, message, requestId, details? } }`, `withRoute` error
  boundary that never leaks stacks/secrets/paths.
- `GET /api/health` liveness endpoint (cheap, structured, `force-dynamic`).
- Foundation security headers via `next.config.ts` (nosniff, DENY, referrer-policy,
  permissions-policy; HSTS in production only) + `poweredByHeader: false`.
- Testing foundation: Vitest 4 (node environment), 24 tests across 5 files (config
  validation, logger behavior/redaction, error mapping/sanitization, health endpoint,
  route error boundary).
- Git repository initialized on `main` with the foundation commit; no secrets committed
  (verified by scan).

## Verification results (this environment)

| Check                                             | Result                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev` (Turbopack)                         | **PASS** — ready in 539 ms; homepage 200; Tailwind CSS served (17.7 KB); `/api/health` 200 |
| `npm run lint`                                    | **PASS** (exit 0, no problems)                                                             |
| `npm run typecheck`                               | **PASS** (exit 0)                                                                          |
| `npm test`                                        | **PASS** — 24/24 tests, 5 files                                                            |
| `npm run build` (default: Turbopack, constrained) | **FAIL — environment memory limit** (exit 137)                                             |
| `npx next build --webpack` (constrained)          | **PASS** — exit 0, ~34 s, ≥ 351 MB RAM free at peak                                        |
| `npm run start` (prod smoke)                      | **PASS** — homepage 200, health 200 (`environment: production`), HSTS active               |

## Build environment limitation (documented per recovery protocol)

- Sandbox: **2 vCPU, 1984 MB RAM, no swap.**
- Constrained Turbopack attempt (`NODE_OPTIONS="--max-old-space-size=1024"`,
  `taskset -c 0`, `NEXT_TELEMETRY_DISABLED=1`): killed after **478 s** with
  **exit code 137 (SIGKILL)**; memory sampler showed available RAM bottoming at **6 MB**.
  Turbopack's native compiler memory exceeds the container limit regardless of the V8
  heap cap (Rust-side allocations are outside `--max-old-space-size`).
- Verdict: **environmental resource limitation, not an application defect** — the same
  source compiles cleanly with the officially supported webpack path in ~34 s with ample
  headroom, and the dev server (also Turbopack) runs fine.
- `next build --help` for the installed 16.3.2 documents `--webpack` as a supported flag;
  no undocumented variables or config guesses were used.
- **Recommended production-build environment:** any machine/CI runner with ≥ 4 GB RAM
  (e.g. GitHub Actions) where default Turbopack builds are expected to work; on ≤ 2 GB
  machines use `NODE_OPTIONS="--max-old-space-size=1536" npx next build --webpack`.

## Successful commands

`npm ci`-equivalent install (npm install, exact pins) · `npm run format` / `format:check` ·
`npm run lint` · `npm run typecheck` · `npm test` · `npm run dev` (verified over HTTP) ·
`npx next build --webpack` (verified exit 0) · `npm run start` (verified over HTTP).

## Failed command (environmental)

`npm run build` (default Turbopack) — exit 137, twice-constrained attempt not retried
further per protocol; classified as **ENVIRONMENT MEMORY LIMIT** for ≤ 2 GB hosts.

## Known issues

1. Default `npm run build` OOMs on ≤ 2 GB machines (see above) — use the documented
   webpack invocation there; revisit nothing in code.
2. Workspace snapshots do not persist `node_modules/` and `.next/`; run `npm ci` after a
   session restore.
3. Workspace snapshots also exclude `.git/config`; future sessions must re-set
   `git config user.name/user.email` before committing (repo objects/refs persist).
4. npm occasionally prints an upgrade notice for npm itself (harmless).

## Architectural decisions (1B-01)

- Dependencies pinned **exact**; every dependency has a current purpose; nothing installed
  for future phases (no Prisma/Supabase/pg-boss/zod yet — zod arrives with request
  validation; the env layer is intentionally hand-rolled until then).
- `eslint-config-next@16` ships native flat config; the legacy FlatCompat bridge crashes
  (circular structure), so native exports `…/core-web-vitals` + `…/typescript` are used
  and `@eslint/eslintrc` was removed after the fix.
- `next lint` is not used (Next 16 removed it); the lint script runs `eslint .` directly.
- Next.js auto-adjusted `tsconfig.json` during the first dev run (`jsx: react-jsx`,
  include of `.next/dev/types`) — Next-managed and expected.
- All environment access flows through `config/env.ts`; logging through `lib/logger.ts`;
  API failures through `withRoute` + `toApiErrorBody`.

## Next task (pending human approval)

Phase 1B-02 — per the approved Phase 1A sequence, the next foundation increment
(database/PostgreSQL + Prisma setup, or the configuration/CI milestone, to be confirmed).
Authentication (Supabase), tenancy/RBAC, and the pg-boss worker remain separate gated
tasks after that.

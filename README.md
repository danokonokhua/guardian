# Guardian

**Digital Business Guardian** — an AI-powered digital business operations platform that
monitors the digital systems businesses depend on, converts technical signals into business
impact, and tells the owner what to fix first.

> **Current phase: 1B — Operations platform foundation (implemented through SLA analytics).**
> The repository contains the authenticated, tenant-isolated monitoring, issue,
> notification, dashboard, analytics, and SLA foundations described by the approved
> Phase 1A architecture (`docs/`).

---

## 1. What Guardian is

Guardian continuously watches revenue-generating digital systems (websites, SSL,
performance, SEO, lead forms, …), detects issues, explains their business impact, scores
digital health, and recommends prioritized actions. Long-term it evolves into an AI
Digital Operations Manager / AI COO for small and medium businesses.

## 2. Current development phase

| Phase                                                                                                        | Status                |
| ------------------------------------------------------------------------------------------------------------ | --------------------- |
| 1A — Architecture & system design                                                                            | Approved              |
| 1B foundation — application, database, auth, tenancy, jobs, monitoring, issues, notifications, SLA analytics | Implemented and gated |

See [`docs/PROJECT_STATE.md`](docs/PROJECT_STATE.md) for the authoritative state record.

## 3. Technology stack

| Layer      | Choice                                             | Version (pinned)                      |
| ---------- | -------------------------------------------------- | ------------------------------------- |
| Framework  | Next.js (App Router, no Pages Router)              | 16.3.2                                |
| UI         | React                                              | 19.2.8                                |
| Language   | TypeScript (strict)                                | 6.0.3                                 |
| Styling    | Tailwind CSS v4 (via `@tailwindcss/postcss`)       | 4.3.3                                 |
| Linting    | ESLint 9 (flat config) + `eslint-config-next`      | 9.39.5                                |
| Formatting | Prettier                                           | 3.9.6                                 |
| Testing    | Vitest                                             | 4.1.11                                |
| Database   | PostgreSQL + Prisma (client runtime; CLI dev-only) | @prisma/client 6.19.2 / prisma 6.19.2 |

Database foundation (PostgreSQL + Prisma) is installed — see
[`docs/DATABASE.md`](docs/DATABASE.md) for the schema/migration workflow.
Planned by the approved architecture: Supabase Auth.

Phase 1B-09 installs pg-boss 12.28.0 in the dedicated `guardian_jobs` schema, with a long-running `system.ping` worker and a guarded `POST /api/cron/tick` scheduler entrypoint.
The exact closure procedure is documented in [`docs/JOB_GATE.md`](docs/JOB_GATE.md).
**No dependency is added before the phase that consumes it.**

## 4. Requirements

- **Node.js ≥ 22.12**. pg-boss 12.x requires Node 22.12+; `.nvmrc` pins `22.12.0`.
- **npm ≥ 10** (no other package manager is required).
- ~600 MB free disk for dependencies.

## 5. Installation

```bash
git clone <repository-url> guardian
cd guardian
npm ci        # or: npm install (no lockfile cache yet on a fresh clone)
```

## 6. Environment configuration

Copy the template and adjust (no real secrets are required for this phase):

```bash
cp .env.example .env.local
```

Variables actually consumed today (via `config/env.ts` only):

| Variable    | Purpose                                              | Required                | Example |
| ----------- | ---------------------------------------------------- | ----------------------- | ------- |
| `LOG_LEVEL` | Minimum logger severity (`debug\|info\|warn\|error`) | no (default `info`)     | `info`  |
| `APP_ENV`   | Deployment label for logs/health                     | no (default `NODE_ENV`) | `local` |

`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, AI/payment keys are **reserved for later
phases** and documented in `.env.example`. Supabase's public URL and anon key are consumed by
the server authentication adapter when configured. All `.env*` files are
gitignored; `.env.example` is the only tracked template.

## 7. Commands

| Command                                                          | Purpose                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `npm run dev`                                                    | Development server (`next dev`, Turbopack)                                               |
| `npm run build`                                                  | Production build — see the memory note below                                             |
| `npm run start`                                                  | Serve the production build (`next build` first)                                          |
| `npm run lint`                                                   | ESLint across the repository                                                             |
| `npm run typecheck`                                              | `tsc --noEmit` under strict settings                                                     |
| `npm test`                                                       | Vitest (single run, CI-friendly)                                                         |
| `npm run test:watch`                                             | Vitest in watch mode                                                                     |
| `npm run format` / `npm run format:check`                        | Prettier write / verify                                                                  |
| `npm run db:generate` / `db:migrate` / `db:deploy` / `db:status` | Prisma client generation & migration workflow (see [docs/DATABASE.md](docs/DATABASE.md)) |
| `npm run test:integration`                                       | Real-PostgreSQL RLS + pg-boss integration gates (requires `TEST_DATABASE_URL`)           |

### Production builds on low-memory machines (≤ 2 GB RAM)

`next build` defaults to **Turbopack** in Next.js 16. Turbopack's native compiler exceeds
2 GB on this tiny app and is killed by the OS (exit 137 / SIGKILL, available RAM → ~6 MB).
This is a resource limitation of the machine, **not an application error** — the same code
compiles cleanly. On machines with ≤ 2 GB RAM use the officially supported webpack path:

```bash
NODE_OPTIONS="--max-old-space-size=1536" npx next build --webpack
```

Verified in CI-style conditions: exit 0 in ~34 s with ≥ 350 MB RAM still free. On machines
with ≥ 4 GB RAM, plain `npm run build` (Turbopack) is expected to work; production builds
should run on a ≥ 4 GB runner (e.g. GitHub Actions).

## 8. Project structure

```
app/                Next.js App Router — layout, landing page, /api/health
app/api/health/     Liveness endpoint (cheap, structured JSON)
components/         Shared UI primitives (empty by design this phase)
config/             Centralized environment configuration (env.ts — the ONLY env reader)
docs/               PROJECT_STATE.md and future architecture docs
lib/                Platform utilities: api.ts (route boundary), errors.ts, logger.ts
services/           Future framework-agnostic domain logic (empty by design)
tests/              Vitest suites: api, config, lib
types/              Shared TypeScript types (API contracts)
```

Conventions: `@/*` path alias; all environment access through `config/env.ts`; all logging
through `lib/logger.ts` (console use is lint-banned outside the logger); API errors use the
canonical envelope `{ error: { code, message, requestId, details? } }`.

## 9. Current limitations

- Foundation only: no authentication, database, monitoring, dashboard, jobs, or AI (by design).
- Production builds need the webpack flag on ≤ 2 GB machines (see above).
- `next start` presumes a completed build in `.next/`.
- The workspace snapshot system does not persist `node_modules/` or `.next/` between
  sessions — run `npm ci` after restoring the repository.

## 10. Next development phase

Phase 1B-02 (per the approved 1A sequence — to be confirmed by human review): extend the
foundation toward the database/configuration milestones (PostgreSQL + Prisma setup), after
which authentication (Supabase Auth), tenancy/RBAC primitives, and the pg-boss job
foundation follow as separate, gated tasks.

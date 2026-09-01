# Phase 1B-09 — Job Foundation Gate

This document defines the exact proof required to close Phase 1B-09.

## Gate A — static quality

Run:

```bash
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
```

Expected: all commands exit 0. The normal unit/API suite may skip database-gated tests when `TEST_DATABASE_URL` is absent.

## Gate B — real PostgreSQL

Use a disposable PostgreSQL database. Never use production data. For Windows/Docker Desktop, the repository includes `docker-compose.test.yml`.

```bash
export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/guardian_test'
export DIRECT_URL="$DATABASE_URL"
export TEST_DATABASE_URL="$DATABASE_URL"
export NODE_ENV=test
export APP_ENV=test
export LOG_LEVEL=error
export CRON_SECRET='replace-with-a-local-test-secret'

npm run db:deploy
npm run test:integration
```

The integration gate proves all of the following against a real PostgreSQL instance:

1. Prisma migrations apply from the committed migration history.
2. `guardian_jobs` exists.
3. pg-boss starts successfully and provisions/updates its own tables.
4. `system.ping` is submitted through the real pg-boss API.
5. A real worker claims the job.
6. The worker completes the job.
7. PostgreSQL visibly records the job as `completed` in `guardian_jobs.job`.

## Gate C — cron authentication

The API tests prove that `POST /api/cron/tick` returns 401 without the secret and does not enqueue a job. A valid bearer secret returns 202 and submits `system.ping`.

For a live smoke test with the development server:

```bash
curl -i -X POST http://localhost:3000/api/cron/tick
curl -i -X POST http://localhost:3000/api/cron/tick \
  -H 'Authorization: Bearer replace-with-the-real-test-secret'
```

Do not place the secret in source control.

## Gate D — CI reproducibility

`.github/workflows/guardian-ci.yml` provisions PostgreSQL as a GitHub Actions service and runs the same static, unit, migration, live-job, build, and secret-scanning gates. This is the canonical environment for the gate when a developer workstation/sandbox has no PostgreSQL daemon.

## Current environment limitation

If the local environment has neither PostgreSQL nor network access for `npm ci`, the live gate cannot honestly be marked passed locally. The correct action is to run the workflow above (or provide a disposable PostgreSQL connection) rather than replacing PostgreSQL with SQLite or weakening the test.

## Windows / Docker Desktop walkthrough

From PowerShell at the repository root:

```powershell
docker compose -f docker-compose.test.yml up -d
docker compose -f docker-compose.test.yml ps

$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/guardian_test"
$env:DIRECT_URL = $env:DATABASE_URL
$env:TEST_DATABASE_URL = $env:DATABASE_URL
$env:NODE_ENV = "test"
$env:APP_ENV = "test"
$env:LOG_LEVEL = "error"
$env:CRON_SECRET = "local-test-cron-secret"

npm ci
npm run db:deploy
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:integration

# In another PowerShell window, after the integration gate is green:
npm run build

docker compose -f docker-compose.test.yml down -v
```

If `npm ci` reports that `package.json` and `package-lock.json` are out of sync, regenerate and commit the lockfile first:

```powershell
npm install --package-lock-only
npm ci
```

The lockfile must be committed after regeneration; do not bypass `npm ci` by deleting the lockfile.

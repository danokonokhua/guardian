# Production deployment on a VPS

Guardian is designed to run as a single Docker Compose project on a VPS:

1. PostgreSQL 16 with a persistent Docker volume.
2. The Next.js web process.
3. One persistent `npm run worker` process.
4. The one-shot Prisma migration and auth-bootstrap services.

This deployment has no Supabase dependency. PostgreSQL, authentication,
sessions, monitoring jobs, and email integration are all configured by the
Compose environment.

## Required `.env`

Start from `.env.example` and set:

```text
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://guardian.example.com
POSTGRES_USER=guardian
POSTGRES_PASSWORD=<long URL-safe random admin password>
POSTGRES_DB=guardian
POSTGRES_APP_USER=guardian_app
POSTGRES_APP_PASSWORD=<different long URL-safe random runtime password>
GUARDIAN_ADMIN_EMAIL=owner@example.com
GUARDIAN_ADMIN_PASSWORD=<long admin password>
CRON_SECRET=<long random secret>
TRUSTED_PROXY=true
TRUSTED_PROXY_TOKEN=<long random value shared only with the reverse proxy>
SMTP_HOST=<provider host>
SMTP_PORT=587
SMTP_USER=<provider username>
SMTP_PASSWORD=<provider token>
SMTP_SECURE=false
MAIL_FROM_EMAIL=<verified sender address>
MAIL_FROM_NAME=Guardian Alerts
```

Use URL-safe database passwords (`A-Z a-z 0-9 . _ -`) so Compose can derive
the connection strings without percent-encoding. Compose creates the
least-privilege `POSTGRES_APP_USER` role before migrations. `DATABASE_URL` is
derived for web/worker/bootstrap; `DIRECT_URL` is derived for migrations only.
Keep `.env` out of Git.

Set `TRUSTED_PROXY=true` only when the reverse proxy is the sole public entry
point, overwrites (not appends) `X-Forwarded-For` and `X-Real-IP`, and injects
the private `X-Guardian-Proxy-Token` header with `TRUSTED_PROXY_TOKEN`. The
Compose web port is bound to `127.0.0.1` so it cannot be reached directly from
the network. Leave this setting false for direct/local access.

## Deploy and verify

```bash
git pull
docker compose up -d --build
docker compose ps
docker compose logs --no-color migrate bootstrap
docker compose logs -f worker
```

The web health endpoints are:

- `GET /api/health` — process liveness.
- `GET /api/health/ready` — liveness plus a database query.

After TLS is configured, verify:

```bash
curl -fsS https://guardian.example.com/api/health/ready
```

Then sign in with the bootstrapped owner account, create or verify a monitor,
run it once, and confirm the worker logs and dashboard show the outcome.

## Reverse proxy and firewall

Bind the reverse proxy to ports 80/443 and forward to `127.0.0.1:3000`.
Keep `GUARDIAN_WEB_PORT` at 3000 on the VPS unless the reverse-proxy upstream
is changed with it. Allow SSH and 80/443 in the VPS firewall. PostgreSQL is not
published by Compose and must remain reachable only on the internal Compose
network.

## Operations

```bash
docker compose logs -f web worker
docker compose restart web worker
docker compose down
docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

`down` preserves data. Back up the Docker volume before upgrades; never use
`down -v` on a production instance unless you intentionally want to erase the
database.

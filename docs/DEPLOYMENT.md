# Production deployment on a VPS

Guardian is designed to run as a single Docker Compose project on a VPS:

1. PostgreSQL 16 with a persistent Docker volume.
2. The Next.js web process.
3. One persistent `npm run worker` process.
4. The one-shot Prisma migration and auth-bootstrap services.

This deployment has no Supabase dependency. PostgreSQL, authentication,
sessions, monitoring jobs, and email integration are all configured by the
Compose environment.

## Required `.env.docker`

Start from `.env.docker.example` and set:

```text
APP_ENV=production
NEXT_PUBLIC_APP_URL=https://guardian.example.com
POSTGRES_USER=guardian
POSTGRES_PASSWORD=<long URL-safe random password>
POSTGRES_DB=guardian
DATABASE_URL=postgresql://guardian:<same-password>@postgres:5432/guardian
DIRECT_URL=postgresql://guardian:<same-password>@postgres:5432/guardian
GUARDIAN_ADMIN_EMAIL=owner@example.com
GUARDIAN_ADMIN_PASSWORD=<long admin password>
CRON_SECRET=<long random secret>
SMTP_HOST=<provider host>
SMTP_PORT=587
SMTP_USER=<provider username>
SMTP_PASSWORD=<provider token>
SMTP_SECURE=false
MAIL_FROM_EMAIL=<verified sender address>
MAIL_FROM_NAME=Guardian Alerts
```

Use a URL-safe database password (`A-Z a-z 0-9 . _ -`) so it does not need
percent-encoding inside the connection strings. Keep `.env.docker` out of Git.

## Deploy and verify

```bash
git pull
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --no-color migrate bootstrap
docker compose --env-file .env.docker logs -f worker
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
Allow SSH and 80/443 in the VPS firewall. PostgreSQL is not published by
Compose and must remain reachable only on the internal Compose network.

## Operations

```bash
docker compose --env-file .env.docker logs -f web worker
docker compose --env-file .env.docker restart web worker
docker compose --env-file .env.docker down
docker compose --env-file .env.docker exec -T postgres pg_isready -U guardian -d guardian
```

`down` preserves data. Back up the Docker volume before upgrades; never use
`down -v` on a production instance unless you intentionally want to erase the
database.

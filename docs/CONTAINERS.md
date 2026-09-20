# Containerized Guardian

The repository ships a self-contained Docker Compose deployment:

- `postgres` — PostgreSQL 16 with a named persistent volume.
- `db-roles` — creates and grants the non-superuser runtime role.
- `migrate` — applies Prisma and pg-boss migrations once with the admin role,
  then exits.
- `bootstrap` — creates the initial local owner account and organization.
- `web` — serves the Next.js dashboard on port 3000.
- `worker` — runs pg-boss, monitoring, SLA escalation, and notifications.

No Supabase service or external database is required.

## Local or VPS start

```powershell
Copy-Item .env.example .env
notepad .env
docker compose up -d --build
docker compose ps
```

Set strong, different URL-safe `POSTGRES_PASSWORD` and `POSTGRES_APP_PASSWORD`
values, the admin account values, and a long random `CRON_SECRET`. Compose
derives `DATABASE_URL` for the runtime role and `DIRECT_URL` for migrations.
For a real VPS set `NEXT_PUBLIC_APP_URL` to the HTTPS hostname. PostgreSQL is
not published to the host; the app reaches it only over the Compose network at
`postgres:5432`.

Open `http://localhost:3000` locally, or put a TLS reverse proxy in front of
port 3000 on the VPS. The Compose stack exposes no public PostgreSQL port.
If port 3000 is already occupied locally, set `GUARDIAN_WEB_PORT=3100` in
`.env` and open `http://localhost:3100`; the internal container port remains 3000.

## Lifecycle

```powershell
docker compose logs -f web worker
docker compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async r => { console.log(await r.text()); process.exit(r.ok ? 0 : 1) }).catch(e => { console.error(e); process.exit(1) })"
docker compose down
```

`down` preserves the database volume. `down -v` permanently removes the local
PostgreSQL data and should only be used when the data is disposable.

On Windows without GNU Make, run the local wrapper commands `.\make health`,
`.\make run`, and `.\make teardown`; the wrapper calls `scripts/guardian.ps1`.

The wrapper reads `.env` for every command. Its `run`/`up` action validates
the container-owned PostgreSQL credentials (`POSTGRES_USER`,
`POSTGRES_PASSWORD`, `POSTGRES_DB`, and `POSTGRES_APP_PASSWORD`), the
bootstrap owner credentials, and `CRON_SECRET` before starting.
`DATABASE_URL` and `DIRECT_URL` are not needed in `.env` for Compose; they are
generated inside the services from the PostgreSQL role settings. SMTP
variables may remain blank for local work, but must be configured before
testing email delivery.

## VPS release order

1. Install Docker Engine and Compose on the VPS.
2. Copy the repository and create `.env` with production secrets.
3. Run `docker compose up -d --build`.
4. Confirm `migrate` and `bootstrap` completed successfully, then inspect
   `docker compose ... logs worker`.
5. Configure a reverse proxy/TLS certificate to forward HTTPS to `127.0.0.1:3000`.
6. Allow only SSH and 80/443 through the firewall. Do not publish 5432.

The worker is required for scheduled monitoring. Keep exactly one worker until
you intentionally scale capacity; pg-boss coordinates jobs, but every worker
adds database and network load.

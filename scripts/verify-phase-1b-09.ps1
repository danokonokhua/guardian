$ErrorActionPreference = "Stop"

Write-Host "=== Guardian Phase 1B-09 verification ===" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker Desktop/CLI is required for the local PostgreSQL gate. Install Docker Desktop first."
}

Write-Host "Starting disposable PostgreSQL..." -ForegroundColor Yellow
docker compose -f docker-compose.test.yml up -d
if ($LASTEXITCODE -ne 0) {
  throw "Docker PostgreSQL startup failed (exit code $LASTEXITCODE). Resolve the container/daemon error and rerun the gate."
}

Write-Host "Waiting for PostgreSQL healthcheck..." -ForegroundColor Yellow
for ($attempt = 1; $attempt -le 30; $attempt++) {
  $health = docker inspect --format='{{.State.Health.Status}}' guardian-postgres-test 2>$null
  if ($health -eq "healthy") { break }
  if ($attempt -eq 30) { throw "PostgreSQL did not become healthy within 150 seconds." }
  Start-Sleep -Seconds 5
}

try {
  $env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/guardian_test"
  $env:DIRECT_URL = $env:DATABASE_URL
  $env:TEST_DATABASE_URL = $env:DATABASE_URL
  $env:NODE_ENV = "test"
  $env:APP_ENV = "test"
  $env:LOG_LEVEL = "error"
  $env:CRON_SECRET = "local-test-cron-secret"

  Write-Host "Installing exact dependencies..." -ForegroundColor Yellow
  npm ci
  if ($LASTEXITCODE -ne 0) { throw "npm ci failed (exit code $LASTEXITCODE). Resolve the install error and rerun the gate." }

  Write-Host "Applying migrations..." -ForegroundColor Yellow
  npm run db:deploy
  if ($LASTEXITCODE -ne 0) { throw "Database migration failed (exit code $LASTEXITCODE)." }

  Write-Host "Running format check..." -ForegroundColor Yellow
  npm run format:check
  if ($LASTEXITCODE -ne 0) { throw "Format check failed (exit code $LASTEXITCODE)." }

  Write-Host "Running lint..." -ForegroundColor Yellow
  npm run lint
  if ($LASTEXITCODE -ne 0) { throw "Lint failed (exit code $LASTEXITCODE)." }

  Write-Host "Running typecheck..." -ForegroundColor Yellow
  npm run typecheck
  if ($LASTEXITCODE -ne 0) { throw "Typecheck failed (exit code $LASTEXITCODE)." }

  Write-Host "Running full unit/API tests..." -ForegroundColor Yellow
  npm test
  if ($LASTEXITCODE -ne 0) { throw "Unit/API tests failed (exit code $LASTEXITCODE)." }

  Write-Host "Running live PostgreSQL integration gates..." -ForegroundColor Yellow
  npm run test:integration
  if ($LASTEXITCODE -ne 0) { throw "Integration tests failed (exit code $LASTEXITCODE)." }

  Write-Host "Running production build..." -ForegroundColor Yellow
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "Production build failed (exit code $LASTEXITCODE)." }

  Write-Host "`nPHASE 1B-09 LOCAL GATE: PASS" -ForegroundColor Green
}
finally {
  Write-Host "Stopping disposable PostgreSQL..." -ForegroundColor Yellow
  docker compose -f docker-compose.test.yml down -v
}

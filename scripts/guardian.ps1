param(
  [Parameter(Position = 0)]
  [ValidateSet("help", "build", "run", "up", "down", "teardown", "restart", "ps", "logs", "migrate-logs", "health")]
  [string]$Target = "help"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$EnvironmentFile = Join-Path $ProjectRoot ".env"
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"

function Show-Help {
  Write-Host "Guardian container commands"
  Write-Host ""
  Write-Host "  .\make build      Build the Guardian web and worker image"
  Write-Host "  .\make run        Start the complete stack in the background"
  Write-Host "  .\make down       Stop the stack and preserve PostgreSQL data"
  Write-Host "  .\make teardown   Alias for .\make down"
  Write-Host "  .\make restart    Restart the web and worker containers"
  Write-Host "  .\make health     Check containers, PostgreSQL, and Guardian readiness"
  Write-Host "  .\make ps         Show container status"
  Write-Host "  .\make logs       Follow web and worker logs"
  Write-Host "  .\make migrate-logs  Show the Prisma migration log"
}

function Assert-Prerequisites {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is not available. Start Docker Desktop and ensure docker.exe is on PATH."
  }
  if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
    throw "Missing .env. Copy .env.example to .env, then fill the required values."
  }
}

function Assert-RuntimeEnvironment {
  $required = @(
    "POSTGRES_PASSWORD",
    "DATABASE_URL",
    "DIRECT_URL",
    "GUARDIAN_ADMIN_EMAIL",
    "GUARDIAN_ADMIN_PASSWORD",
    "CRON_SECRET",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "MAIL_FROM_EMAIL"
  )
  $values = @{}
  Get-Content -LiteralPath $EnvironmentFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]*)=(.*)$') {
      $values[$matches[1].Trim()] = $matches[2].Trim().Trim('"')
    }
  }
  $missing = @($required | Where-Object {
      -not $values.ContainsKey($_) -or
      [string]::IsNullOrWhiteSpace($values[$_]) -or
      $values[$_] -match 'CHANGE_ME|<SET>|YOUR_PASSWORD|replace-with'
    })
  if ($missing.Count -gt 0) {
    throw "Complete these values in .env before starting Guardian: $($missing -join ', ')"
  }
}

function Invoke-ComposeControl {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  # Compose interpolates the whole file even for down/ps/logs. Use the shared
  # `.env` source for every operation; control commands do not require complete
  # runtime credentials.
  & docker compose --env-file $EnvironmentFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & docker compose --env-file $EnvironmentFile -f $ComposeFile @Arguments
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

if ($Target -eq "help") {
  Show-Help
  exit 0
}

Assert-Prerequisites
Set-Location -LiteralPath $ProjectRoot

switch ($Target) {
  "build" {
    Invoke-ComposeControl build
  }
  { $_ -in @("run", "up") } {
    Assert-RuntimeEnvironment
    Invoke-Compose up -d
  }
  { $_ -in @("down", "teardown") } {
    Invoke-ComposeControl down
  }
  "restart" {
    Invoke-ComposeControl restart web worker
  }
  "ps" {
    Invoke-ComposeControl ps
  }
  "logs" {
    Invoke-ComposeControl logs -f web worker
  }
  "migrate-logs" {
    Invoke-ComposeControl logs --no-color migrate
  }
  "health" {
    Invoke-ComposeControl ps
    Invoke-ComposeControl exec -T postgres pg_isready -U guardian -d guardian
    Invoke-ComposeControl exec -T web node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(async response => { console.log(await response.text()); process.exit(response.ok ? 0 : 1); }).catch(error => { console.error(error); process.exit(1); })"
    Invoke-ComposeControl exec -T worker node -e "console.log('Guardian worker container is running')"
  }
}

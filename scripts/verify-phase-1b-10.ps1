$ErrorActionPreference = "Stop"
$env:npm_config_prefix = "C:\Program Files\nodejs"

Write-Host "=== Guardian Phase 1B-10 verification ===" -ForegroundColor Cyan

function Invoke-Checked([string]$Command, [string]$Label) {
  Write-Host $Label -ForegroundColor Yellow
  Invoke-Expression $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit code $LASTEXITCODE)." }
}

Invoke-Checked "npm run format:check" "Running format check..."
Invoke-Checked "npm run lint" "Running lint..."
Invoke-Checked "npm run typecheck" "Running typecheck..."
Invoke-Checked "npm test" "Running unit/API tests..."
Invoke-Checked "npm run build" "Running production build..."

Write-Host "`nPHASE 1B-10 STATIC GATE: PASS" -ForegroundColor Green

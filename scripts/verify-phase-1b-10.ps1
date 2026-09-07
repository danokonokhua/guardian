$ErrorActionPreference = "Stop"

Write-Host "=== Guardian Phase 1B-10 verification ===" -ForegroundColor Cyan

function Invoke-Checked([scriptblock]$Command, [string]$Label) {
  Write-Host $Label -ForegroundColor Yellow
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "$Label failed (exit code $LASTEXITCODE)." }
}

$node = (Get-Command node -ErrorAction Stop).Source

# Invoke the pinned local CLIs directly. This keeps the gate independent of a
# globally installed npm shim (which is often unavailable on shared Windows
# workstations) and uses webpack for the low-memory production build path.
Invoke-Checked { & $node node_modules/prettier/bin/prettier.cjs --check . } "Running format check..."
Invoke-Checked { & $node node_modules/eslint/bin/eslint.js . } "Running lint..."
Invoke-Checked { & $node node_modules/typescript/bin/tsc --noEmit } "Running typecheck..."
Invoke-Checked { & $node node_modules/vitest/vitest.mjs run } "Running unit/API tests..."
Invoke-Checked { & $node node_modules/next/dist/bin/next build --webpack } "Running production build..."

Write-Host "`nPHASE 1B-10 STATIC GATE: PASS" -ForegroundColor Green

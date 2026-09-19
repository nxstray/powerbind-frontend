# Runs frontend tests with coverage + SonarQube analysis in one command.
#
#   .\run-sonar-frontend.ps1              # tests + coverage only (no Sonar push)
#   .\run-sonar-frontend.ps1 -Token xxx   # .env override, one-off token
#
# Credentials are loaded from ./.env (see ./.env.example):
#   SONAR_HOST_URL   - SonarQube server (default http://localhost:9000)
#   SONAR_TOKEN      - analysis token generated in the SonarQube UI
# A -Token parameter overrides the .env value for one run.
#
# NOTE: this file is ASCII-only on purpose. Windows PowerShell 5.1 reads .ps1
# files without a BOM as ANSI, so any non-ASCII char breaks parsing.
#
# First-time SonarQube setup (same server as backend):
#   1. http://localhost:9000 > Projects > Create > Manual - key: powerbind-frontend
#   2. Generate a token (My Account > Security) and put it in ./.env as SONAR_TOKEN
#
# Requires @vitest/coverage-v8 (already in devDependencies).
# No clean/delete steps - vitest regenerates coverage/ itself each run.

param(
    [string]$Token,
    [string]$SonarHost,
    [string]$ProjectKey = "powerbind-frontend"
)

# --- load ./.env (KEY=VALUE lines, '#' comments ignored) ----------------------
$envMap = @{}
$envFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and -not $line.TrimStart().StartsWith('#')) {
            $envMap[$Matches[1]] = $Matches[2]
        }
    }
} else {
    Write-Host "No .env found (expected at $envFile) - copy .env.example first." -ForegroundColor Yellow
}

$SonarHost = if ($SonarHost) { $SonarHost } else { if ($envMap['SONAR_HOST_URL']) { $envMap['SONAR_HOST_URL'] } else { 'http://localhost:9000' } }
$Token     = if ($Token)     { $Token }     else { $envMap['SONAR_TOKEN'] }

Write-Host "Running frontend tests with coverage..." -ForegroundColor Cyan
npx vitest run --coverage
$testExitCode = $LASTEXITCODE

if ($testExitCode -ne 0) {
    Write-Host "Tests FAILED (exit $testExitCode) - SonarQube analysis skipped." -ForegroundColor Red
    exit $testExitCode
}

Write-Host "Coverage lcov report: coverage/lcov.info" -ForegroundColor DarkGray

if (-not $Token) {
    Write-Host "No SONAR_TOKEN in .env and no -Token given - analysis NOT pushed to SonarQube." -ForegroundColor Yellow
    exit 0
}

Write-Host "Pushing analysis to SonarQube at $SonarHost (project: $ProjectKey)..." -ForegroundColor Cyan
# Host scanner via npm (sonarqube-scanner) - uses the host's Java (17, already
# required by Maven). Avoids the Docker scanner image, whose bundled JVM failed
# to start under this WSL2 setup ("line 66: .../bin/java: Success").
#
# Call the local binary DIRECTLY: `npx sonarqube-scanner` resolves the package
# name to a different bin and hangs on a hidden interactive prompt.
$env:SONAR_HOST_URL = $SonarHost
$env:SONAR_TOKEN = $Token
& ".\node_modules\.bin\sonar-scanner-npm.cmd"
$sonarExitCode = $LASTEXITCODE

if ($sonarExitCode -ne 0) {
    Write-Host "SonarQube analysis FAILED (exit $sonarExitCode)." -ForegroundColor Red
    exit $sonarExitCode
}

Write-Host "Done. View results at $SonarHost/dashboard?id=$ProjectKey" -ForegroundColor Green
exit 0

<#
.SYNOPSIS
    Generate a CycloneDX SBOM (software bill of materials) for the frontend.

.DESCRIPTION
    Uses the SBOM command that ships with npm 11: "npm sbom --sbom-format
    cyclonedx". No extra tooling is installed and nothing is downloaded.

    PREREQUISITE - a healthy dependency tree. npm validates the tree before it
    emits a BOM and aborts with "ESBOMPROBLEMS" when something is off; run
    "npm ls" to list the problems. Known issues at the time of writing:

      1. missing peer dependencies for recharts (react, react-dom, react-is).
         recharts is a React library and is not imported anywhere in src/, so
         the dependency looks like leftover.
      2. version conflict: eslint-plugin-oxlint requires oxlint ~1.73.0 while
         package.json pins oxlint ~1.74.0.
      3. missing optional platform package @emnapi/core, required by
         @tailwindcss/oxide-wasm32-wasi.

    Until 1-3 are resolved npm refuses to emit the BOM and this script exits
    with a diagnostic. Tools that ignore npm's tree validation (Trivy, Syft)
    can still produce a frontend SBOM in the meantime, for example:
        docker run --rm -v "${PWD}:/src" aquasec/trivy fs --format cyclonedx `
            --output /src/sbom/bom-trivy.json /src

    devDependencies are included by default on purpose: build tooling
    (vite, vitest, eslint) runs in CI and on developer machines, so it is part
    of the supply chain surface. Use -RuntimeOnly to omit them.

.NOTES
    ASCII only - Windows PowerShell 5.1 reads BOM-less scripts as ANSI.
#>
param(
    [switch] $RuntimeOnly
)

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

$outDir = Join-Path $PSScriptRoot 'sbom'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
$outFile = Join-Path $outDir 'bom.json'

$sbomArgs = @('sbom', '--sbom-format', 'cyclonedx', '--sbom-type', 'application')
if ($RuntimeOnly) { $sbomArgs += @('--omit', 'dev') }
$scopeLabel = if ($RuntimeOnly) { 'runtime deps only' } else { 'all deps' }

Write-Host "Generating CycloneDX SBOM via npm ($scopeLabel) ..." -ForegroundColor Cyan
$raw = & npm @sbomArgs 2>$null | Out-String

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    Write-Host 'SBOM generation FAILED - npm refused to emit a BOM.' -ForegroundColor Red
    Write-Host 'The dependency tree has to be healthy first; see the notes at the top of this script.' -ForegroundColor Yellow
    Write-Host 'Inspect it with:' -ForegroundColor Yellow
    Write-Host '    npm ls --all' -ForegroundColor DarkGray
    exit 1
}

[IO.File]::WriteAllText($outFile, $raw, (New-Object Text.UTF8Encoding($false)))

# count components with node: avoids Windows PowerShell 5.1 JSON quirks on big files
$count = & node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(String(j.components?j.components.length:0));" $outFile
if ($LASTEXITCODE -ne 0) {
    Write-Host "The BOM written to $outFile is not valid JSON - removing it." -ForegroundColor Red
    Remove-Item $outFile -Force -ErrorAction SilentlyContinue
    exit 1
}

$sizeKb = [math]::Round((Get-Item $outFile).Length / 1KB, 1)
Write-Host "SBOM written: $outFile ($sizeKb KB, $count components)" -ForegroundColor Green


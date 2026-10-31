$ErrorActionPreference = 'Stop'
$postgresRoot = $env:CLAIMS_POSTGRES_ROOT
if ([string]::IsNullOrWhiteSpace($postgresRoot)) {
  $postgresRoot = Join-Path $env:USERPROFILE 'Documents\Codex\.local-services\postgres'
}
$bin = Join-Path $postgresRoot '18.6\bin'
$data = Join-Path $postgresRoot 'data-utf8'
$pgCtl = Join-Path $bin 'pg_ctl.exe'

& $pgCtl '-D' $data 'status' *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output 'PostgreSQL is already stopped.'
  exit 0
}

& $pgCtl '-D' $data 'stop' '-m' 'fast' '-w' '-t' '30'
if ($LASTEXITCODE -ne 0) { throw "pg_ctl stop failed with exit code $LASTEXITCODE" }
Write-Output 'PostgreSQL stopped cleanly.'

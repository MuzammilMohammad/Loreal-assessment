$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$postgresRoot = $env:CLAIMS_POSTGRES_ROOT
if ([string]::IsNullOrWhiteSpace($postgresRoot)) {
  $postgresRoot = Join-Path $env:USERPROFILE 'Documents\Codex\.local-services\postgres'
}
$bin = Join-Path $postgresRoot '18.6\bin'
$data = Join-Path $postgresRoot 'data-utf8'
$postgres = Join-Path $bin 'postgres.exe'
$pgIsReady = Join-Path $bin 'pg_isready.exe'

function Test-PostgresPort {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $pending = $client.BeginConnect('127.0.0.1', 5432, $null, $null)
    if (-not $pending.AsyncWaitHandle.WaitOne(700)) { return $false }
    $client.EndConnect($pending)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (Test-Path (Join-Path $projectRoot '.env')) {
  $databaseLine = Get-Content (Join-Path $projectRoot '.env') | Where-Object { $_ -match '^DATABASE_URL\s*=' } | Select-Object -First 1
  if ($databaseLine -match '^DATABASE_URL\s*=\s*"?([^"\s]+)') {
    $databaseUri = [Uri]$matches[1]
    if ($databaseUri.Host -notin @('localhost', '127.0.0.1', '::1')) {
      Write-Output "Using the configured PostgreSQL host $($databaseUri.Host); no local server is needed."
      exit 0
    }
  }
}

if (Test-PostgresPort) {
  Write-Output 'PostgreSQL is already listening on port 5432.'
  exit 0
}

if (-not (Test-Path $postgres) -or -not (Test-Path (Join-Path $data 'PG_VERSION'))) {
  throw "No PostgreSQL server is running on localhost:5432 and portable binaries were not found under $postgresRoot. Start PostgreSQL or configure a hosted DATABASE_URL."
}

$out = Join-Path $postgresRoot 'postgres.stdout.log'
$err = Join-Path $postgresRoot 'postgres.stderr.log'
$process = Start-Process -FilePath $postgres -ArgumentList @('-D', $data, '-h', '127.0.0.1', '-p', '5432') -WorkingDirectory $bin -RedirectStandardOutput $out -RedirectStandardError $err -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  Start-Sleep -Seconds 1
  if (Test-PostgresPort) {
    Write-Output "PostgreSQL is running on 127.0.0.1:5432 (PID $($process.Id))."
    exit 0
  }
  if ($process.HasExited) { break }
}

Get-Content -Path $err -Tail 30 -ErrorAction SilentlyContinue
throw 'PostgreSQL did not start. See postgres.stderr.log in the local services folder.'

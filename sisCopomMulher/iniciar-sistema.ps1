# Inicia PostgreSQL (5433) + servidor Next.js (3001) em janela minimizada.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sistema = Join-Path $root "sistema"
$env:OPEN_BROWSER = "0"

$healthOk = $false
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/health" -UseBasicParsing -TimeoutSec 3
  $healthOk = $r.StatusCode -eq 200
} catch {}

if ($healthOk) {
  Write-Host "[COPOM Mulher] Servidor ja esta no ar: http://localhost:3001"
  Write-Host "Login: rafael / senha: 123"
  exit 0
}

Start-Process powershell -WindowStyle Minimized -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
  "Set-Location '$sistema'; `$env:OPEN_BROWSER='0'; npm run up"
)

$deadline = (Get-Date).AddSeconds(90)
while ((Get-Date) -lt $deadline) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/health" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) {
      Write-Host "[COPOM Mulher] Servidor no ar: http://localhost:3001"
      Write-Host "Login: rafael / senha: 123"
      exit 0
    }
  } catch {}
}

Write-Host "[COPOM Mulher] Servidor a iniciar em segundo plano. Aguarde e abra http://localhost:3001"
exit 1

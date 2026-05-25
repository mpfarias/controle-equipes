# Sobe servidor central (3001) + app mobile Expo (8095) — alertas em /app/central-vitima
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sistema = Join-Path $root "sistema"
$mobile = Join-Path $root "mobile-vitima"

$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
  $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notlike "169.254*" -and ($_.IPAddress -match "^192\.168\." -or $_.IPAddress -match "^10\." -or $_.IPAddress -match "^172\.(1[6-9]|2[0-9]|3[0-1])\.")
} | Select-Object -First 1 -ExpandProperty IPAddress)

if (-not $ip) { $ip = "127.0.0.1" }

# Garantir .env.local do mobile com IP atual
$envLocal = Join-Path $mobile ".env.local"
@"
COPOM_LAN_REWRITE=$ip
EXPO_PUBLIC_API_BASE_URL=http://${ip}:3001
"@ | Set-Content -Path $envLocal -Encoding UTF8

# Servidor central (PostgreSQL + Next produção)
$centralOk = $false
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/health" -UseBasicParsing -TimeoutSec 4
  $centralOk = $r.StatusCode -eq 200
} catch {}

if (-not $centralOk) {
  Write-Host "[COPOM] A iniciar servidor central (porta 3001)..." -ForegroundColor Magenta
  Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    "Set-Location '$sistema'; `$env:OPEN_BROWSER='0'; npm run up"
  )
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 2
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:3001/api/health" -UseBasicParsing -TimeoutSec 3
      if ($r.StatusCode -eq 200) { $centralOk = $true; break }
    } catch {}
  }
}

# Metro Expo (app vítima)
$expoOk = $false
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8095" -UseBasicParsing -TimeoutSec 3
  $expoOk = $r.StatusCode -ge 200
} catch {}

if (-not $expoOk) {
  Write-Host "[COPOM] A iniciar app mobile Expo (porta 8095)..." -ForegroundColor Magenta
  Remove-Item Env:CI -ErrorAction SilentlyContinue
  Start-Process powershell -WindowStyle Minimized -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command",
    "Set-Location '$mobile'; Remove-Item Env:CI -ErrorAction SilentlyContinue; npm start"
  )
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:8095" -UseBasicParsing -TimeoutSec 3 | Out-Null
      $expoOk = $true
      break
    } catch {}
  }
}

Write-Host ""
Write-Host "=== COPOM Mulher — central + mobile ===" -ForegroundColor Green
Write-Host "  Central (operador):  http://127.0.0.1:3001/app/central-vitima" -ForegroundColor Cyan
Write-Host "  Login:               rafael / 123" -ForegroundColor Gray
Write-Host "  App mobile (Expo):   http://${ip}:8095" -ForegroundColor Cyan
Write-Host "  API no telemóvel:    http://${ip}:3001" -ForegroundColor Cyan
Write-Host "  Emulador Android:    http://10.0.2.2:3001 (ou adb reverse tcp:3001 tcp:3001)" -ForegroundColor Gray
Write-Host ""
if (-not $centralOk) { Write-Host "Aviso: servidor central ainda a arrancar - aguarde ~1 min." -ForegroundColor Yellow }
if (-not $expoOk) { Write-Host "Aviso: Expo ainda a arrancar - abra http://${ip}:8095 no telemovel." -ForegroundColor Yellow }

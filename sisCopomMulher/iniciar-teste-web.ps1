# Só a aplicação web (porta 3001), sem Metro/Expo.
# Vítima no telemóvel: http://<IP-deste-PC>:3001/mobile-vitima
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sistema = Join-Path $root "sistema"
if (-not (Test-Path $sistema)) { Write-Error "Pasta sistema nao encontrada: $sistema"; exit 1 }

$ip = $null
try {
  $ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
    $_.InterfaceAlias -notmatch "Loopback" -and $_.IPAddress -notlike "169.254*"
  } | Select-Object -First 1).IPAddress
} catch { }

Write-Host "=== COPOM Mulher (web apenas, porta 3001) ===" -ForegroundColor Magenta
Write-Host "  No PC:    http://127.0.0.1:3001/login" -ForegroundColor Cyan
Write-Host "  Vitima:   http://<IP-PC>:3001/mobile-vitima" -ForegroundColor Cyan
if ($ip) { Write-Host "  (possivel IP: $ip)" -ForegroundColor Gray }
Write-Host "  Lista:    TESTE-URLS.txt na raiz" -ForegroundColor DarkGray
Write-Host ""

$cmd = "Set-Location `"$sistema`"; npm run pc"
Start-Process powershell -WorkingDirectory $sistema -ArgumentList @("-NoExit", "-Command", $cmd)

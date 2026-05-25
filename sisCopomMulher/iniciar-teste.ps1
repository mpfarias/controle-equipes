# Inicia o sistema web (porta 3001) e o Metro do app móvel em duas janelas PowerShell.
# No terminal do Expo: prima "a" para abrir no emulador Android (Android Studio + AVD instalados).
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$sistema = Join-Path $root "sistema"
$mobile = Join-Path $root "mobile-vitima"

Write-Host "A abrir:" -ForegroundColor Cyan
Write-Host "  1) Next.js em http://127.0.0.1:3001" -ForegroundColor Gray
Write-Host "  2) Expo Metro na porta 8095 (no terminal do Expo use a tecla 'a' para Android)" -ForegroundColor Gray
Write-Host "  3) Vítima: app mobile-vitima (Expo tecla a); /mobile-vitima no browser é só informativo" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $sistema)) { Write-Error "Pasta sistema nao encontrada: $sistema"; exit 1 }
if (-not (Test-Path $mobile)) { Write-Error "Pasta mobile-vitima nao encontrada: $mobile"; exit 1 }

$cmdWeb = "Set-Location `"$sistema`"; Write-Host '=== COPOM Mulher (web) ===' -ForegroundColor Magenta; npm run pc"
Start-Process powershell -WorkingDirectory $sistema -ArgumentList @("-NoExit", "-Command", $cmdWeb)

Start-Sleep -Seconds 4

Remove-Item Env:CI -ErrorAction SilentlyContinue
$cmdExpo = "Set-Location `"$mobile`"; Remove-Item Env:CI -ErrorAction SilentlyContinue; Write-Host '=== Expo (app vitima) Metro:8095, host LAN (telemovel) ===' -ForegroundColor Magenta; Write-Host 'Prima a para Android. Telemovel: use o exp://IP-que-nao-e-127 no Expo Go' -ForegroundColor Yellow; npm start"
Start-Process powershell -WorkingDirectory $mobile -ArgumentList @("-NoExit", "-Command", $cmdExpo)

Write-Host "Janelas abertas. Web operador: http://127.0.0.1:3001/login | Vítima: app Expo/ADB (código de ativação + URL API = este host:3001)" -ForegroundColor Green

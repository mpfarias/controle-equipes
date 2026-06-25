# Instala o serviço Windows OrionCOPOM (inicialização automática após reboot)
param(
    [switch]$Force,
    [switch]$SkipBuild,
    [switch]$StartNow
)

. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

if (-not (Test-OrionAdministrator)) {
    Write-Error 'Execute este script como Administrador (PowerShell elevado).'
}

Ensure-OrionLogsDirectory

if (-not $SkipBuild) {
    if (-not (Test-OrionProductionBuild)) {
        Invoke-OrionProductionBuild
    } else {
        Write-Host '[orion] Builds de produção OK.' -ForegroundColor DarkGray
    }
}

$nssm = Get-OrionNssmExecutable
if (-not $nssm) {
    $nssm = Install-OrionNssmTool
}

$launcher = Get-OrionServiceLauncherScript
if (-not (Test-Path $launcher)) {
    throw "Launcher não encontrado: $launcher"
}

$existing = Get-Service -Name $Script:OrionServiceName -ErrorAction SilentlyContinue
if ($existing -and -not $Force) {
    Write-Host "Serviço $($Script:OrionServiceName) já existe. Use -Force para reinstalar." -ForegroundColor Yellow
    exit 1
}

if ($existing) {
    if ($existing.Status -eq 'Running') {
        Stop-Service -Name $Script:OrionServiceName -Force
    }
    & $nssm remove $Script:OrionServiceName confirm
    Start-Sleep -Seconds 2
}

$powershell = (Get-Command powershell.exe).Source
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`" -SkipBuild"

Write-Host "Instalando serviço $($Script:OrionServiceName)..." -ForegroundColor Cyan
& $nssm install $Script:OrionServiceName $powershell $arguments
$nodeExe = Get-OrionNodeExecutable
$nodeDir = Split-Path $nodeExe -Parent
$npmExe = Get-OrionNpmExecutable
$dockerDir = Split-Path (Get-OrionDockerExecutable) -Parent
$envExtra = @(
    "PATH=$nodeDir;$dockerDir;$env:ProgramFiles\nodejs;$env:ProgramFiles\Docker\Docker\resources\bin"
    "NODE_ENV=production"
    "ORION_ROOT=$Script:OrionRoot"
) -join "`n"
& $nssm set $Script:OrionServiceName AppEnvironmentExtra $envExtra
& $nssm set $Script:OrionServiceName AppDirectory $Script:OrionRoot
& $nssm set $Script:OrionServiceName DisplayName 'Orion COPOM — Ecossistema'
& $nssm set $Script:OrionServiceName Description 'API NestJS + SPAs Órion (SAD, Suporte, Qualidade, etc.) em modo produção.'
& $nssm set $Script:OrionServiceName Start SERVICE_DELAYED_AUTO_START
& $nssm set $Script:OrionServiceName AppStdout (Join-Path $Script:OrionLogsDir 'orion-service-stdout.log')
& $nssm set $Script:OrionServiceName AppStderr (Join-Path $Script:OrionLogsDir 'orion-service-stderr.log')
& $nssm set $Script:OrionServiceName AppStdoutCreationDisposition 4
& $nssm set $Script:OrionServiceName AppStderrCreationDisposition 4
& $nssm set $Script:OrionServiceName AppRotateFiles 1
& $nssm set $Script:OrionServiceName AppRotateOnline 1
& $nssm set $Script:OrionServiceName AppRotateBytes 10485760
& $nssm set $Script:OrionServiceName AppExit Default Restart
& $nssm set $Script:OrionServiceName AppRestartDelay 15000
& $nssm set $Script:OrionServiceName AppThrottle 60000
& $nssm set $Script:OrionServiceName AppStopMethodSkip 0
& $nssm set $Script:OrionServiceName AppKillProcessTree 1

# Instalar tarefa agendada para Postgres subir antes do serviço principal
& (Join-Path $PSScriptRoot 'Install-OrionPostgresAutostart.ps1') -Force

Write-Host ''
Write-Host 'Serviço instalado com sucesso.' -ForegroundColor Green
Write-Host "  Nome: $($Script:OrionServiceName)"
Write-Host "  Logs: $Script:OrionLogsDir"
Write-Host ''
Write-Host 'Comandos úteis:' -ForegroundColor Cyan
Write-Host "  Start-Service $($Script:OrionServiceName)"
Write-Host "  Stop-Service $($Script:OrionServiceName)"
Write-Host "  Get-Service $($Script:OrionServiceName)"
Write-Host ''
Write-Host 'Portas em produção:' -ForegroundColor DarkGray
Write-Host '  API 3002 | SAD 5173 | Suporte 5180 | Qualidade 5182 | Jurídico 5183'
Write-Host '  Patrimônio 5184 | Mulher 5185 | Agenda 5186 | Operações 5187'
Write-Host ''
Write-Host 'IMPORTANTE: pare processos manuais (npm run start:full:prod) antes de iniciar o serviço.' -ForegroundColor Yellow

if ($StartNow) {
    Start-Service -Name $Script:OrionServiceName
    Write-Host 'Serviço iniciado.' -ForegroundColor Green
} else {
    $answer = Read-Host 'Iniciar serviço agora? (S/N)'
    if ($answer -match '^[sS]') {
        Start-Service -Name $Script:OrionServiceName
        Write-Host 'Serviço iniciado.' -ForegroundColor Green
    }
}

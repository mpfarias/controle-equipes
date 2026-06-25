# Ponto de entrada do serviço Windows OrionCOPOM (sem interação)
param(
    [switch]$SkipBuild,
    [switch]$SkipDocker
)

. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

Set-OrionProductionEnvironment
Ensure-OrionLogsDirectory

$logFile = Join-Path $Script:OrionLogsDir 'orion-service.log'

function Write-OrionServiceLog {
    param([string]$Message)
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
    Add-Content -Path $logFile -Value $line -Encoding UTF8
    Write-Host $line
}

try {
    Write-OrionServiceLog "Iniciando ecossistema Órion (produção) — raiz: $Script:OrionRoot"

    if (-not $SkipBuild) {
        if (-not (Test-OrionProductionBuild)) {
            Write-OrionServiceLog 'Build ausente — executando build:full...'
            Invoke-OrionProductionBuild
        } else {
            Write-OrionServiceLog 'Builds de produção já presentes.'
        }
    }

    if (-not $SkipDocker) {
        Start-OrionPostgres
        if (-not (Wait-OrionPostgresReady)) {
            throw 'PostgreSQL indisponível após timeout.'
        }
        Write-OrionServiceLog 'PostgreSQL pronto.'
    }

    Invoke-OrionPrismaMigrate
    Write-OrionServiceLog 'Migrations aplicadas.'

    $watchdog = Start-Process -FilePath (Get-Command powershell.exe).Source `
        -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $PSScriptRoot 'Start-OrionMissingSpas.ps1') `
        -WorkingDirectory $Script:OrionRoot -WindowStyle Hidden -PassThru
    Write-OrionServiceLog "Watchdog SPAs iniciado (PID $($watchdog.Id))."

    Write-OrionServiceLog 'Subindo stack (npm run start:full:prod)...'
    Start-OrionProductionStack
}
catch {
    Write-OrionServiceLog "ERRO FATAL: $($_.Exception.Message)"
    throw
}

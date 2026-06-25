# Executado pela Tarefa Agendada no boot — sobe Docker + Postgres
$ErrorActionPreference = 'Continue'

. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

Ensure-OrionLogsDirectory
$log = Join-Path $Script:OrionLogsDir 'orion-postgres-boot.log'

function Log([string]$msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content -Path $log -Value $line -Encoding UTF8
}

try {
    Set-OrionProductionEnvironment
    Log 'Boot task: iniciando Docker/Postgres...'

    if (-not (Test-OrionDockerReady)) {
        Start-OrionDockerDesktop | Out-Null
        if (-not (Wait-OrionDockerReady -TimeoutSeconds 240)) {
            Log 'ERRO: Docker não ficou pronto.'
            exit 1
        }
    }

    Start-OrionPostgres
    if (Wait-OrionPostgresReady -TimeoutSeconds 180) {
        Log 'PostgreSQL healthy.'
        exit 0
    }
    Log 'AVISO: Postgres subiu mas healthcheck não confirmou healthy.'
    exit 0
}
catch {
    Log "ERRO: $($_.Exception.Message)"
    exit 1
}

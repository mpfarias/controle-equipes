# Inicia o ecossistema Órion em produção (manual ou diagnóstico)
param(
    [switch]$SkipBuild,
    [switch]$SkipDocker
)

. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

Set-OrionProductionEnvironment
Ensure-OrionLogsDirectory
Set-Location $Script:OrionRoot

Write-Host '========================================' -ForegroundColor Cyan
Write-Host ' Órion COPOM — modo produção' -ForegroundColor Cyan
Write-Host " Raiz: $Script:OrionRoot" -ForegroundColor DarkGray
Write-Host '========================================' -ForegroundColor Cyan

if (-not $SkipBuild) {
    if (-not (Test-OrionProductionBuild)) {
        Invoke-OrionProductionBuild
    } else {
        Write-Host '[orion] Builds de produção já presentes (use -SkipBuild:$false para forçar rebuild).' -ForegroundColor DarkGray
    }
}

if (-not $SkipDocker) {
    Start-OrionPostgres
}

if (-not (Wait-OrionPostgresReady)) {
    throw 'PostgreSQL indisponível. Verifique Docker Desktop ou instância local na porta 5432.'
}

Invoke-OrionPrismaMigrate

Start-OrionProductionStack

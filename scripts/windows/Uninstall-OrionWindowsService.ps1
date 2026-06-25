# Remove o serviço Windows OrionCOPOM
param([switch]$Force)

. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

if (-not (Test-OrionAdministrator)) {
    Write-Error 'Execute como Administrador.'
}

$nssm = Get-OrionNssmExecutable
$existing = Get-Service -Name $Script:OrionServiceName -ErrorAction SilentlyContinue

if (-not $existing) {
    Write-Host "Serviço $($Script:OrionServiceName) não está instalado."
    exit 0
}

if (-not $Force) {
    $answer = Read-Host "Remover serviço $($Script:OrionServiceName)? (S/N)"
    if ($answer -notmatch '^[sS]') { exit 0 }
}

if ($existing.Status -eq 'Running') {
    Stop-Service -Name $Script:OrionServiceName -Force
}

if ($nssm) {
    & $nssm remove $Script:OrionServiceName confirm
} else {
    sc.exe delete $Script:OrionServiceName | Out-Null
}

Write-Host "Serviço $($Script:OrionServiceName) removido." -ForegroundColor Green

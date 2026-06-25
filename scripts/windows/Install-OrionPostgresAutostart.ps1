# Tarefa agendada: sobe PostgreSQL (Docker) no boot, antes do serviço OrionCOPOM
param([switch]$Force)

. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

if (-not (Test-OrionAdministrator)) {
    Write-Error 'Execute como Administrador.'
}

$taskName = $Script:OrionPostgresTaskName
$scriptPath = Join-Path $PSScriptRoot 'Start-OrionPostgresTask.ps1'

if (-not (Test-Path $scriptPath)) {
    throw "Script auxiliar não encontrado: $scriptPath"
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing -and -not $Force) {
    Write-Host "Tarefa $taskName já existe (use -Force para recriar)." -ForegroundColor DarkGray
    return
}

if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$trigger.Delay = 'PT1M'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 2)
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Sobe PostgreSQL do Órion COPOM via Docker Compose no boot.' | Out-Null

Write-Host "Tarefa agendada $taskName registrada (PostgreSQL no boot, +1 min)." -ForegroundColor Green

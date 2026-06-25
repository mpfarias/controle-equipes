# Para o ecossistema Órion (serviço Windows ou processos manuais nas portas de produção)
param([switch]$ServiceOnly)

. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

$svc = Get-Service -Name $Script:OrionServiceName -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq 'Running') {
    Write-Host "Parando serviço $($Script:OrionServiceName)..." -ForegroundColor Yellow
    Stop-Service -Name $Script:OrionServiceName -Force
    Write-Host 'Serviço parado.' -ForegroundColor Green
}

if ($ServiceOnly) { return }

$ports = @(3002, 5173, 5180, 5182, 5183, 5184, 5185, 5186, 5187)
foreach ($port in $ports) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) {
            foreach ($pid in ($conn.OwningProcess | Select-Object -Unique)) {
                Write-Host "Encerrando PID $pid na porta $port" -ForegroundColor DarkGray
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
            }
        }
    } catch { }
}

Write-Host 'Portas de produção liberadas.' -ForegroundColor Green

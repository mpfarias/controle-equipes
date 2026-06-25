# Verifica portas 51xx e sobe SPAs que faltarem (pico de memória no boot)
. (Join-Path $PSScriptRoot 'orion-prod-common.ps1')

Set-OrionProductionEnvironment
Start-Sleep -Seconds 20

$spaScripts = [ordered]@{
    5173 = 'start:web:prod'
    5180 = 'start:orion-suporte:prod'
    5182 = 'start:orion-qualidade:prod'
    5183 = 'start:orion-juridico:prod'
    5184 = 'start:orion-patrimonio:prod'
    5185 = 'start:orion-mulher:prod'
    5186 = 'start:orion-agenda:prod'
    5187 = 'start:orion-operacoes:prod'
}

$npm = Get-OrionNpmExecutable
foreach ($entry in $spaScripts.GetEnumerator()) {
    $port = $entry.Key
    $script = $entry.Value
    $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($listening) { continue }
    Write-Host "[orion] Subindo $script (porta $port ausente)..." -ForegroundColor Yellow
    Start-Process -FilePath $npm -ArgumentList 'run', $script -WorkingDirectory $Script:OrionRoot -WindowStyle Hidden
    Start-Sleep -Seconds 4
}

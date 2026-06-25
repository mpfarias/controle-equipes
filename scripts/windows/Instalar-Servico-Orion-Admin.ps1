# Atalho: instalar serviço Windows OrionCOPOM (requer Administrador)
# Clique com botão direito → "Executar com PowerShell" ou abra PowerShell como Admin.

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
& (Join-Path $PSScriptRoot 'Install-OrionWindowsService.ps1')

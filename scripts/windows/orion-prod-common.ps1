# Funções compartilhadas — Órion COPOM em produção (Windows)
$ErrorActionPreference = 'Stop'

$Script:OrionRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Script:OrionServiceName = 'OrionCOPOM'
$Script:OrionPostgresTaskName = 'OrionCOPOM-Postgres'
$Script:OrionLogsDir = Join-Path $Script:OrionRoot 'logs'

$Script:OrionWebPackages = @(
    @{ Name = 'afastamentos-web'; Dist = 'dist/index.html' },
    @{ Name = 'orion-suporte-web'; Dist = 'dist/index.html' },
    @{ Name = 'orion-qualidade-web'; Dist = 'dist/index.html' },
    @{ Name = 'orion-juridico-web'; Dist = 'dist/index.html' },
    @{ Name = 'orion-patrimonio-web'; Dist = 'dist/index.html' },
    @{ Name = 'orion-mulher-web'; Dist = 'dist/index.html' },
    @{ Name = 'orion-agenda-web'; Dist = 'dist/index.html' },
    @{ Name = 'orion-operacoes-web'; Dist = 'dist/index.html' }
)

function Test-OrionAdministrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-OrionLogsDirectory {
    if (-not (Test-Path $Script:OrionLogsDir)) {
        New-Item -ItemType Directory -Path $Script:OrionLogsDir -Force | Out-Null
    }
}

function Ensure-OrionJwtSecret {
    $envFile = Join-Path $Script:OrionRoot 'afastamentos-api\.env'
    $example = Join-Path $Script:OrionRoot 'afastamentos-api\.env.example'
    if (-not (Test-Path $envFile) -and (Test-Path $example)) {
        Copy-Item $example $envFile
    }
    if (-not (Test-Path $envFile)) {
        throw 'Arquivo afastamentos-api/.env não encontrado. Copie de .env.example.'
    }
    $lines = Get-Content $envFile
    $hasJwt = $lines | Where-Object { $_ -match '^\s*JWT_SECRET\s*=' }
    if ($hasJwt) { return }
    $bytes = New-Object byte[] 48
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)
    Add-Content -Path $envFile -Value "`nJWT_SECRET=`"$secret`""
    Write-Host '[orion] JWT_SECRET gerado em afastamentos-api/.env (obrigatório em NODE_ENV=production).' -ForegroundColor Yellow
}

function Set-OrionProductionEnvironment {
    Ensure-OrionJwtSecret
    $env:NODE_ENV = 'production'
    $env:CI = 'true'
    # Não usar max-old-space-size global: 9 processos Node reservariam GB demais (VirtualAlloc no Windows).
    $env:NODE_OPTIONS = '--no-warnings'
    $env:UV_THREADPOOL_SIZE = '64'
    # PATH completo para serviço Windows (NSSM não herda perfil do usuário)
    $extraPaths = @(
        "$env:ProgramFiles\nodejs",
        "${env:ProgramFiles(x86)}\nodejs",
        "$env:LOCALAPPDATA\Programs\node",
        "$env:APPDATA\npm",
        "$env:ProgramFiles\Docker\Docker\resources\bin"
    )
    foreach ($p in $extraPaths) {
        if ((Test-Path $p) -and ($env:Path -notlike "*$p*")) {
            $env:Path = "$p;$env:Path"
        }
    }
}

function Get-OrionNodeExecutable {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $candidates = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:LOCALAPPDATA\Programs\node\node.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) { return $c }
    }
    throw 'Node.js não encontrado. Instale LTS em https://nodejs.org e reinicie o terminal.'
}

function Get-OrionNpmExecutable {
    $cmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $nodeDir = Split-Path (Get-OrionNodeExecutable) -Parent
    $npm = Join-Path $nodeDir 'npm.cmd'
    if (Test-Path $npm) { return $npm }
    throw 'npm não encontrado no PATH.'
}

function Get-OrionDockerExecutable {
    $cmd = Get-Command docker -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $docker = "$env:ProgramFiles\Docker\Docker\resources\bin\docker.exe"
    if (Test-Path $docker) { return $docker }
    throw 'Docker não encontrado. Instale Docker Desktop para o PostgreSQL local.'
}

function Test-OrionProductionBuild {
    $apiMain = Join-Path $Script:OrionRoot 'afastamentos-api/dist/main.js'
    if (-not (Test-Path $apiMain)) { return $false }
    foreach ($pkg in $Script:OrionWebPackages) {
        $distFile = Join-Path $Script:OrionRoot "$($pkg.Name)/$($pkg.Dist)"
        if (-not (Test-Path $distFile)) { return $false }
    }
    return $true
}

function Invoke-OrionProductionBuild {
    Write-Host '[orion] Build completo de produção (API + SPAs)...' -ForegroundColor Yellow
    Set-Location $Script:OrionRoot
    Set-OrionProductionEnvironment
    & (Get-OrionNpmExecutable) run build:full
    if ($LASTEXITCODE -ne 0) { throw "build:full falhou com código $LASTEXITCODE" }
    Write-Host '[orion] Build concluído.' -ForegroundColor Green
}

function Start-OrionDockerDesktop {
    $desktop = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    if (-not (Test-Path $desktop)) { return $false }
    $proc = Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue
    if ($proc) { return $true }
    Write-Host '[orion] Iniciando Docker Desktop...' -ForegroundColor Yellow
    Start-Process -FilePath $desktop | Out-Null
    return $true
}

function Test-OrionDockerReady {
    try {
        & (Get-OrionDockerExecutable) info 2>$null | Out-Null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Wait-OrionDockerReady {
    param([int]$TimeoutSeconds = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-OrionDockerReady) { return $true }
        Start-Sleep -Seconds 3
    }
    return $false
}

function Start-OrionPostgres {
    Set-Location $Script:OrionRoot
    if (-not (Test-OrionDockerReady)) {
        Start-OrionDockerDesktop | Out-Null
        if (-not (Wait-OrionDockerReady)) {
            throw 'Docker Desktop não ficou pronto a tempo.'
        }
    }
    Write-Host '[orion] Subindo PostgreSQL (docker compose up -d)...' -ForegroundColor Cyan
    & (Get-OrionDockerExecutable) compose up -d
    if ($LASTEXITCODE -ne 0) { throw "docker compose up falhou com código $LASTEXITCODE" }
}

function Wait-OrionPostgresReady {
    param([int]$TimeoutSeconds = 120)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $status = & (Get-OrionDockerExecutable) inspect --format='{{.State.Health.Status}}' afastamentos-postgres 2>$null
            if ($status -eq 'healthy') { return $true }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Invoke-OrionPrismaMigrate {
    Write-Host '[orion] Aplicando migrations Prisma...' -ForegroundColor Cyan
    $apiDir = Join-Path $Script:OrionRoot 'afastamentos-api'
    Push-Location $apiDir
    try {
        Set-OrionProductionEnvironment
        & (Get-OrionNpmExecutable) run prisma:generate
        if ($LASTEXITCODE -ne 0) { throw 'prisma:generate falhou' }
        & (Get-OrionNpmExecutable) run prisma:migrate
        if ($LASTEXITCODE -ne 0) { throw 'prisma:migrate falhou' }
    } finally {
        Pop-Location
    }
}

function Start-OrionProductionStack {
    Write-Host '[orion] Iniciando API + SPAs em produção (portas 3002, 51xx)...' -ForegroundColor Green
    Set-Location $Script:OrionRoot
    Set-OrionProductionEnvironment
    & (Get-OrionNpmExecutable) run start:full:prod
}

function Get-OrionNssmExecutable {
    $local = Join-Path $PSScriptRoot 'tools\nssm.exe'
    if (Test-Path $local) { return $local }
    $pf = "${env:ProgramFiles}\nssm\nssm.exe"
    if (Test-Path $pf) { return $pf }
    return $null
}

function Install-OrionNssmTool {
    $toolsDir = Join-Path $PSScriptRoot 'tools'
    New-Item -ItemType Directory -Force -Path $toolsDir | Out-Null
    $target = Join-Path $toolsDir 'nssm.exe'
    if (Test-Path $target) { return $target }

    Write-Host '[orion] Baixando NSSM 2.24...' -ForegroundColor Yellow
    $zipPath = Join-Path $toolsDir 'nssm-2.24.zip'
    $extractDir = Join-Path $toolsDir 'nssm-2.24'
    Invoke-WebRequest -Uri 'https://nssm.cc/release/nssm-2.24.zip' -OutFile $zipPath -UseBasicParsing
    Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force
    $win64 = Get-ChildItem -Path $extractDir -Recurse -Filter 'nssm.exe' |
        Where-Object { $_.FullName -match 'win64' } |
        Select-Object -First 1
    if (-not $win64) { throw 'NSSM win64 não encontrado no ZIP.' }
    Copy-Item $win64.FullName $target -Force
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
    return $target
}

function Get-OrionServiceLauncherScript {
    return (Join-Path $PSScriptRoot 'Orion-Production-Service.ps1')
}

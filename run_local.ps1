# UUS Delhi - one-command local launcher.
# Usage:  powershell -ExecutionPolicy Bypass -File .\run_local.ps1
#         powershell -ExecutionPolicy Bypass -File .\run_local.ps1 -Prod   (production build + start)

param([switch]$Prod)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvPy = Join-Path $root '.venv\Scripts\python.exe'

function Test-Port([int]$Port) {
    try {
        $c = New-Object Net.Sockets.TcpClient
        $c.Connect('127.0.0.1', $Port); $c.Close(); return $true
    } catch { return $false }
}

function Wait-HttpOk([string]$Url, [int]$Seconds) {
    foreach ($i in 1..$Seconds) {
        Start-Sleep -Seconds 2
        try { Invoke-RestMethod $Url -TimeoutSec 3 | Out-Null; return $true } catch {}
    }
    return $false
}

# ── 1. Python venv ────────────────────────────────────────────────────────────
if (-not (Test-Path $venvPy)) {
    Write-Host '[1/4] Creating Python venv (first run only)...' -ForegroundColor Yellow
    python -m venv (Join-Path $root '.venv')
    & $venvPy -m pip install --quiet --disable-pip-version-check -r (Join-Path $backend 'requirements.txt')
} else {
    Write-Host '[1/4] venv OK' -ForegroundColor Green
}

# ── 2. Backend on :8000 ───────────────────────────────────────────────────────
if (Test-Port 8000) {
    Write-Host '[2/4] Port 8000 busy - assuming backend already running' -ForegroundColor Cyan
} else {
    Write-Host '[2/4] Starting FastAPI backend on :8000 ...' -ForegroundColor Yellow
    Start-Process -FilePath $venvPy `
        -ArgumentList '-m','uvicorn','main:app','--host','127.0.0.1','--port','8000' `
        -WorkingDirectory $backend -WindowStyle Hidden
}
Write-Host '      Waiting for /api/health (first start loads model + CSV, can take ~30s)...'
if (-not (Wait-HttpOk 'http://127.0.0.1:8000/api/health' 45)) {
    Write-Host '      BACKEND FAILED to become healthy. Check backend/uvicorn logs.' -ForegroundColor Red
    exit 1
}
$health = Invoke-RestMethod 'http://127.0.0.1:8000/api/health'
if ($health.status -ne 'ok') {
    Write-Host "      Backend degraded: $($health | ConvertTo-Json -Compress)" -ForegroundColor Red
    exit 1
}
Write-Host '      Backend healthy (model + dataset loaded)' -ForegroundColor Green

# ── 3. Frontend on :3000 ──────────────────────────────────────────────────────
if (Test-Port 3000) {
    Write-Host '[3/4] Port 3000 busy - frontend already running' -ForegroundColor Cyan
} else {
    Write-Host '[3/4] Starting Next.js frontend on :3000 ...' -ForegroundColor Yellow
    Push-Location $frontend
    if ($Prod) {
        if (-not (Test-Path '.next')) { npm run build }
        Start-Process -FilePath 'cmd' -ArgumentList '/c','npm','run','start' `
            -WorkingDirectory $frontend -WindowStyle Hidden
    } else {
        Start-Process -FilePath 'cmd' -ArgumentList '/c','npm','run','dev' `
            -WorkingDirectory $frontend -WindowStyle Hidden
    }
    Pop-Location
}

Write-Host '[4/4] Waiting for http://localhost:3000 ...'
$ready = $false
foreach ($i in 1..45) {
    Start-Sleep -Seconds 2
    try { (Invoke-WebRequest 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 3) | Out-Null; $ready = $true; break } catch {}
}
if (-not $ready) { Write-Host 'FRONTEND FAILED to start.' -ForegroundColor Red; exit 1 }

Write-Host ''
Write-Host '=========================================================' -ForegroundColor Green
Write-Host ' UUS Delhi is running:' -ForegroundColor Green
Write-Host '   Site:     http://localhost:3000' -ForegroundColor White
Write-Host '   API docs: http://127.0.0.1:8000/docs' -ForegroundColor White
Write-Host '=========================================================' -ForegroundColor Green
Start-Process 'http://localhost:3000'

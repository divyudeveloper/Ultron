$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCommand) {
    $node = $nodeCommand.Source
} elseif (Test-Path "C:\Program Files\nodejs\node.exe") {
    $node = "C:\Program Files\nodejs\node.exe"
} else {
    throw "Node.js is not installed or not available in PATH."
}
$server = Join-Path $PSScriptRoot "backend\server.js"
$pidFile = Join-Path $PSScriptRoot ".ultron.pid"

# If an ULTRON server is already answering, reuse it.
try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/status" -TimeoutSec 2 -UseBasicParsing
    if ($health.StatusCode -eq 200) {
        Start-Process "http://127.0.0.1:3000/"
        exit 0
    }
} catch {}

$p = Start-Process -FilePath $node `
    -ArgumentList "`"$server`"" `
    -WorkingDirectory $PSScriptRoot `
    -WindowStyle Normal `
    -PassThru

$p.Id | Set-Content -Path $pidFile

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep -Milliseconds 500
    try {
        $health = Invoke-WebRequest -Uri "http://127.0.0.1:3000/api/status" -TimeoutSec 2 -UseBasicParsing
        if ($health.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
}

if (-not $ready) {
    try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    throw "ULTRON server did not become ready on port 3000."
}

Start-Process "http://127.0.0.1:3000/"

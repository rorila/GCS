# Compatibility entry point: the CMS itself now manages its local speech services.
param([int]$PiperPort = 5000)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$env:CMS_TTS_URL = "http://127.0.0.1:$PiperPort/"
Push-Location $projectRoot
try { node scripts/cms/cms-server.cjs; if ($LASTEXITCODE -ne 0) { throw "CMS beendet mit Fehlercode $LASTEXITCODE." } }
finally { Pop-Location }

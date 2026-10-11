#Requires -Version 5.1
param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$ttsRoot = Join-Path $projectRoot 'game-server/tts'
$localPython = Join-Path $ttsRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $localPython)) {
    & $Python -m venv (Join-Path $ttsRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Die projektlokale Python-Umgebung konnte nicht erstellt werden.' }
}
& $localPython -m pip install -r (Join-Path $ttsRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'Piper/FFmpeg konnten nicht installiert werden.' }
$voiceDir = Join-Path $ttsRoot 'voices'
New-Item -ItemType Directory -Path $voiceDir -Force | Out-Null
& $localPython -m piper.download_voices --download-dir $voiceDir de_DE-thorsten-medium de_DE-kerstin-low de_DE-ramona-low
if ($LASTEXITCODE -ne 0) { throw 'Die Stimmenmodelle konnten nicht installiert werden.' }
$whisperExe = Join-Path $projectRoot 'tools/speech-service/whisper/Release/whisper-server.exe'
$whisperModel = Join-Path $projectRoot 'tools/speech-service/models/ggml-small.bin'
if (-not (Test-Path -LiteralPath $whisperExe) -or -not (Test-Path -LiteralPath $whisperModel)) {
    & (Join-Path $PSScriptRoot 'speech/install-speech-service.ps1') -Model small -NoSmokeTest
}
Write-Host '[OK] Lokale Sprachdienste in v2 eingerichtet. Normaler Start: npm start oder npm run start:cms.'

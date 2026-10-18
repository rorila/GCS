#Requires -Version 5.1
<#
.SYNOPSIS
    Installiert den lokalen Spracherkennungsdienst (whisper.cpp) fuer das GCS-CMS.

.DESCRIPTION
    - Laedt ein angepinntes Windows-x64-Binary von whisper.cpp herunter (CPU-Build).
    - Laedt ein mehrsprachiges Modell (Standard: small, ~466 MB) von Hugging Face.
    - Erzeugt start-speech.cmd, das whisper-server auf 127.0.0.1:<Port> bindet.
    - Traegt CMS_SPEECH_URL in die .env ein und ignoriert das Install-Verzeichnis via .gitignore.
    - Fuehrt optional einen Smoke-Test aus (Server starten, Test-WAV senden, Server stoppen).

    Kein Cloud-Fallback: Der Dienst bindet ausschliesslich an 127.0.0.1.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\speech\install-speech-service.ps1
    powershell -ExecutionPolicy Bypass -File scripts\speech\install-speech-service.ps1 -Model base
#>
param(
    [ValidateSet('tiny','base','small','medium')]
    [string]$Model = 'small',
    [string]$WhisperBuild = 'b5454',
    [int]$Port = 8177,
    [string]$InstallDir = '',
    [switch]$Force,
    [switch]$NoSmokeTest
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not $InstallDir) { $InstallDir = Join-Path $repoRoot 'tools\speech-service' }
$binDir   = Join-Path $InstallDir 'whisper'
$modelDir = Join-Path $InstallDir 'models'
$zipPath  = Join-Path $InstallDir 'whisper-bin-x64.zip'
$modelPath = Join-Path $modelDir "ggml-$Model.bin"
$binUrl   = "https://github.com/ggml-org/whisper.cpp/releases/download/$WhisperBuild/whisper-bin-x64.zip"
$modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-$Model.bin"

function Get-File($url, $dest, $label) {
    if ((Test-Path $dest) -and -not $Force) { Write-Host "[OK] $label bereits vorhanden: $dest"; return }
    Write-Host "[..] Lade $label ..."
    $tmp = "$dest.part"
    & curl.exe -fL --retry 3 -o $tmp $url
    if ($LASTEXITCODE -ne 0) { Remove-Item $tmp -ErrorAction SilentlyContinue; throw "Download fehlgeschlagen: $url" }
    Move-Item $tmp $dest -Force
    Write-Host "[OK] $label -> $dest"
}

New-Item -ItemType Directory -Force -Path $binDir, $modelDir | Out-Null

# --- 1) Binary ---
Get-File $binUrl $zipPath 'whisper.cpp Windows-Binary'
$serverExe = Get-ChildItem $binDir -Recurse -Filter 'whisper-server.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
if ((-not $serverExe) -or $Force) {
    Write-Host '[..] Entpacke Binary ...'
    Expand-Archive -Path $zipPath -DestinationPath $binDir -Force
    $serverExe = Get-ChildItem $binDir -Recurse -Filter 'whisper-server.exe' | Select-Object -First 1
}
if (-not $serverExe) { throw 'whisper-server.exe wurde im Paket nicht gefunden.' }
$serverPath = $serverExe.FullName
Write-Host "[OK] whisper-server: $serverPath"

# --- 2) Modell ---
Get-File $modelUrl $modelPath "Modell ggml-$Model.bin"

# --- 3) Startskript ---
$startCmd = Join-Path $InstallDir 'start-speech.cmd'
@"
@echo off
rem Lokaler Spracherkennungsdienst fuer GCS-CMS (nur 127.0.0.1, kein Cloud-Fallback)
"$serverPath" --host 127.0.0.1 --port $Port -m "$modelPath" -l de
"@ | Set-Content -Path $startCmd -Encoding ASCII
Write-Host "[OK] Startskript: $startCmd"

# --- 4) .env ---
$envFile = Join-Path $repoRoot '.env'
$envLine = "CMS_SPEECH_URL=http://127.0.0.1:$Port/inference"
$envText = if (Test-Path $envFile) { Get-Content $envFile -Raw } else { '' }
if ($envText -match '(?m)^\s*CMS_SPEECH_URL\s*=') {
    $envText = $envText -replace '(?m)^\s*CMS_SPEECH_URL\s*=.*$', $envLine
} else {
    $envText = $envText.TrimEnd() + "`r`n# Lokaler Spracherkennungsdienst (whisper.cpp)`r`n$envLine`r`n"
}
Set-Content -Path $envFile -Value $envText -NoNewline -Encoding UTF8
Write-Host "[OK] .env: $envLine"

# --- 5) .gitignore ---
$gitignore = Join-Path $repoRoot '.gitignore'
$entry = 'tools/speech-service/'
$gitText = if (Test-Path $gitignore) { Get-Content $gitignore -Raw } else { '' }
if ($gitText -notmatch [regex]::Escape($entry)) {
    Set-Content -Path $gitignore -Value ($gitText.TrimEnd() + "`r`n`r`n# Lokaler Spracherkennungsdienst (Binaerdateien/Modelle)`r`n$entry`r`n") -NoNewline -Encoding UTF8
    Write-Host '[OK] .gitignore: tools/speech-service/'
}

# --- 6) Smoke-Test ---
if (-not $NoSmokeTest) {
    Write-Host '[..] Smoke-Test: starte Dienst kurz und sende Test-WAV ...'
    $wavPath = Join-Path $InstallDir 'smoke-test.wav'
    $ms = New-Object IO.MemoryStream
    $bw = New-Object IO.BinaryWriter($ms)
    $samples = 24000  # 1,5 s PCM16 mono 16 kHz
    $bw.BaseStream.SetLength(0)
    $bw.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
    $bw.Write([uint32](36 + $samples * 2))
    $bw.Write([Text.Encoding]::ASCII.GetBytes('WAVE'))
    $bw.Write([Text.Encoding]::ASCII.GetBytes('fmt '))
    $bw.Write([uint32]16); $bw.Write([uint16]1); $bw.Write([uint16]1)
    $bw.Write([uint32]16000); $bw.Write([uint32]32000); $bw.Write([uint16]2); $bw.Write([uint16]16)
    $bw.Write([Text.Encoding]::ASCII.GetBytes('data'))
    $bw.Write([uint32]($samples * 2))
    $tone = New-Object byte[] ($samples * 2)
    for ($i = 0; $i -lt $samples; $i++) {
        $v = [int16]([Math]::Sin(2 * [Math]::PI * 440 * $i / 16000) * 8000)
        $tone[$i * 2] = $v -band 0xFF; $tone[$i * 2 + 1] = ($v -shr 8) -band 0xFF
    }
    $bw.Write($tone); $bw.Flush()
    [IO.File]::WriteAllBytes($wavPath, $ms.ToArray()); $bw.Dispose()

    $proc = Start-Process -FilePath $serverPath -ArgumentList '--host','127.0.0.1','--port',"$Port",'-m',"`"$modelPath`"",'-l','de' -PassThru -WindowStyle Hidden
    try {
        $ready = $false
        for ($i = 0; $i -lt 90; $i++) {
            Start-Sleep -Seconds 1
            if ($proc.HasExited) { throw "whisper-server ist vorzeitig beendet (Exit $($proc.ExitCode))." }
            try { Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -UseBasicParsing -TimeoutSec 2 | Out-Null; $ready = $true; break } catch {}
        }
        if (-not $ready) { throw 'whisper-server antwortet nicht auf /' }

        Add-Type -AssemblyName System.Net.Http
        $client = [System.Net.Http.HttpClient]::new()
        $client.Timeout = [TimeSpan]::FromSeconds(120)
        $form = [System.Net.Http.MultipartFormDataContent]::new()
        $fileBytes = [IO.File]::ReadAllBytes($wavPath)
        $fileContent = [System.Net.Http.ByteArrayContent]::new($fileBytes)
        $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse('audio/wav')
        $form.Add($fileContent, 'file', 'answer.wav')
        foreach ($kv in @{language='de';response_format='json';temperature='0';temperature_inc='0'}.GetEnumerator()) {
            $form.Add([System.Net.Http.StringContent]::new($kv.Value), $kv.Key)
        }
        $resp = $client.PostAsync("http://127.0.0.1:$Port/inference", $form).Result
        $body = $resp.Content.ReadAsStringAsync().Result
        if (-not $resp.IsSuccessStatusCode) { throw "/inference antwortete mit HTTP $([int]$resp.StatusCode): $body" }
        $json = $body | ConvertFrom-Json
        if ($null -eq $json.text) { throw "Antwort ohne 'text'-Feld: $body" }
        Write-Host "[OK] /inference antwortete: text='$($json.text)' (Ton-Test: Inhalt egal, Format entscheidend)"
    }
    finally { if (-not $proc.HasExited) { Stop-Process -Id $proc.Id -Force } }
}

Write-Host ''
Write-Host '=== Fertig ==='
Write-Host "Dienst starten:  $startCmd"
Write-Host "CMS neu starten: .env enthaelt CMS_SPEECH_URL (wird beim Serverstart geladen)"
Write-Host "Modell wechseln: Skript erneut mit -Model tiny|base|small|medium ausfuehren"

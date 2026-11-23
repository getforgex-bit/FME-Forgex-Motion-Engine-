param(
  [string]$FreecutDir = 'C:\Users\bogex\Documents\Forgex\FME-ext\freecut',
  [ValidateSet('auto', 'msedge', 'chrome', 'playwright')]
  [string]$Browser = 'auto'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'node no encontrado en PATH.'
}
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw 'ffmpeg no encontrado en PATH.'
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
  throw 'ffprobe no encontrado en PATH.'
}
if (-not (Test-Path $FreecutDir)) {
  throw "No se encontro FreeCut en: $FreecutDir"
}

$outDir = Join-Path $PSScriptRoot 'out'
if (Test-Path $outDir) {
  Remove-Item -Path $outDir -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$workspaceDir = Join-Path $outDir 'workspace'
$inputClip = Join-Path $outDir 'test-clip-5s.mp4'
$exportedClip = Join-Path $outDir 'exported.mp4'
$sampleProjectOut = Join-Path $PSScriptRoot 'sample-project.json'
$reportOut = Join-Path $outDir 'report.json'
$stdoutLog = Join-Path $outDir 'e2e.stdout.log'
$stderrLog = Join-Path $outDir 'e2e.stderr.log'

$headlessHtml = Join-Path $FreecutDir 'dist\headless.html'
if (-not (Test-Path $headlessHtml)) {
  Write-Host 'Compilando dist/headless.html en FreeCut...'
  Push-Location $FreecutDir
  try {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & npm.cmd run build
    $buildExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($buildExit -ne 0) {
      throw "npm.cmd run build fallo con codigo $buildExit"
    }
  } finally {
    Pop-Location
  }
}

Write-Host '1. Generando clip de entrada con FFmpeg...'
$clipJsonRaw = & (Join-Path $PSScriptRoot 'generate-test-clip.ps1') -OutDir $outDir -FileName 'test-clip-5s.mp4'
$clipSummaryText = ($clipJsonRaw | Where-Object { $_ -is [string] -and $_ -notmatch '^Generando clip' }) -join "`n"
$clipSummary = $clipSummaryText | ConvertFrom-Json

Write-Host "2. Ejecutando flujo FreeCut E2E (browser=$Browser)..."
$driverScript = Join-Path $PSScriptRoot 'freecut-e2e.mjs'
$driverArgs = @(
  "`"$driverScript`"",
  '--freecut-dir', "`"$FreecutDir`"",
  '--workspace', "`"$workspaceDir`"",
  '--input', "`"$inputClip`"",
  '--out', "`"$exportedClip`"",
  '--project-out', "`"$sampleProjectOut`"",
  '--browser', $Browser
) -join ' '

$hasNvidiaSmi = [bool](Get-Command nvidia-smi -ErrorAction SilentlyContinue)
$baselineBrowserPids = @{}
foreach ($p in (Get-Process -Name 'msedge', 'chrome', 'chrome-headless-shell' -ErrorAction SilentlyContinue)) {
  $baselineBrowserPids[$p.Id] = $true
}

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath 'node' -ArgumentList $driverArgs -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
$null = $proc.Handle

$peakNodeMb = 0.0
$peakBrowserGroupMb = 0.0
$vramSamples = New-Object System.Collections.Generic.List[int]
$tick = 0

while (-not $proc.HasExited) {
  Start-Sleep -Milliseconds 250
  $tick += 1

  try {
    $nodeProc = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    if ($nodeProc) {
      $nodeMb = [math]::Round($nodeProc.WorkingSet64 / 1MB, 2)
      if ($nodeMb -gt $peakNodeMb) { $peakNodeMb = $nodeMb }
    }
  } catch {}

  $newBrowserBytes = 0L
  foreach ($bp in (Get-Process -Name 'msedge', 'chrome', 'chrome-headless-shell' -ErrorAction SilentlyContinue)) {
    if (-not $baselineBrowserPids.ContainsKey($bp.Id)) {
      $newBrowserBytes += $bp.WorkingSet64
    }
  }
  $browserMb = [math]::Round($newBrowserBytes / 1MB, 2)
  if ($browserMb -gt $peakBrowserGroupMb) { $peakBrowserGroupMb = $browserMb }

  if ($hasNvidiaSmi -and ($tick % 4 -eq 1)) {
    try {
      $prevEap = $ErrorActionPreference
      $ErrorActionPreference = 'Continue'
      $smiOut = & nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>$null
      $ErrorActionPreference = $prevEap
      if ($smiOut) {
        $firstLine = ($smiOut | Select-Object -First 1).ToString().Trim()
        $parsedVram = 0
        if ([int]::TryParse($firstLine, [ref]$parsedVram)) {
          $vramSamples.Add($parsedVram) | Out-Null
        }
      }
    } catch {}
  }
}

$proc.WaitForExit()
$sw.Stop()
$e2eExit = $proc.ExitCode
if ($e2eExit -ne 0) {
  $errText = if (Test-Path $stderrLog) { Get-Content -Path $stderrLog -Raw } else { '' }
  throw "freecut-e2e.mjs fallo con codigo $e2eExit`: $errText"
}

if (-not (Test-Path $exportedClip)) {
  throw "No se genero el archivo exportado esperado: $exportedClip"
}

$e2eJson = (Get-Content -Path $stdoutLog -Raw) | ConvertFrom-Json

Write-Host '3. Verificando MP4 exportado con ffprobe y SHA-256...'
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$probeRaw = & ffprobe -v error -show_format -show_streams -of json $exportedClip
$probeExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($probeExit -ne 0) {
  throw "ffprobe fallo sobre $exportedClip con codigo $probeExit"
}

$probe = $probeRaw | ConvertFrom-Json
$videoStream = $probe.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
$audioStream = $probe.streams | Where-Object { $_.codec_type -eq 'audio' } | Select-Object -First 1

if (-not $videoStream) {
  throw 'El MP4 exportado no contiene stream de video.'
}

$exportHash = (Get-FileHash -Algorithm SHA256 -Path $exportedClip).Hash
$exportInfo = Get-Item -Path $exportedClip

$vramMin = $null
$vramMax = $null
if ($vramSamples.Count -gt 0) {
  $measured = $vramSamples | Measure-Object -Minimum -Maximum
  $vramMin = [int]$measured.Minimum
  $vramMax = [int]$measured.Maximum
}

$report = [ordered]@{
  verifiedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  freecutDir = $FreecutDir
  totalWallMs = [math]::Round($sw.Elapsed.TotalMilliseconds, 2)
  resources = [ordered]@{
    peakNodeRamMiB = $peakNodeMb
    peakSpawnedBrowserRamMiB = $peakBrowserGroupMb
    vramSamplesCount = $vramSamples.Count
    vramMinMiB = $vramMin
    vramMaxMiB = $vramMax
  }
  inputClip = $clipSummary
  e2e = $e2eJson
  exportedFile = [ordered]@{
    path = $exportedClip
    sizeBytes = $exportInfo.Length
    sha256 = $exportHash
    formatName = $probe.format.format_name
    formatDurationSec = [double]$probe.format.duration
    video = [ordered]@{
      codec = $videoStream.codec_name
      pixFmt = $videoStream.pix_fmt
      width = [int]$videoStream.width
      height = [int]$videoStream.height
      avgFrameRate = $videoStream.avg_frame_rate
      rFrameRate = $videoStream.r_frame_rate
      nbFrames = [int]$videoStream.nb_frames
      durationSec = [double]$videoStream.duration
    }
    audio = if ($audioStream) {
      [ordered]@{
        codec = $audioStream.codec_name
        sampleRate = [int]$audioStream.sample_rate
        channels = [int]$audioStream.channels
        durationSec = [double]$audioStream.duration
      }
    } else {
      $null
    }
  }
}

$reportJson = $report | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($reportOut, "$reportJson`n", [System.Text.Encoding]::UTF8)
Write-Output $reportJson

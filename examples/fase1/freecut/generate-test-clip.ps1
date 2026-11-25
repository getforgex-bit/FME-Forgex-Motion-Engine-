param(
  [string]$OutDir = (Join-Path $PSScriptRoot 'out'),
  [string]$FileName = 'test-clip-5s.mp4',
  [switch]$NoAudio
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  throw 'ffmpeg no encontrado en PATH.'
}
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
  throw 'ffprobe no encontrado en PATH.'
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$outFile = Join-Path $OutDir $FileName

$ffmpegArgs = @(
  '-y',
  '-hide_banner',
  '-loglevel', 'error',
  '-f', 'lavfi',
  '-i', 'testsrc2=size=1280x720:rate=30:duration=5'
)

if (-not $NoAudio) {
  $ffmpegArgs += @(
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:sample_rate=48000:duration=5',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-shortest'
  )
}

$ffmpegArgs += @(
  '-c:v', 'libx264',
  '-pix_fmt', 'yuv420p',
  '-r', '30',
  '-movflags', '+faststart',
  '-map_metadata', '-1',
  $outFile
)

Write-Host "Generando clip de prueba en: $outFile"
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
& ffmpeg @ffmpegArgs
$ffmpegExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($ffmpegExit -ne 0) {
  throw "ffmpeg fallo con codigo $ffmpegExit"
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
$probeJson = & ffprobe -v error -show_format -show_streams -of json $outFile
$ffprobeExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($ffprobeExit -ne 0) {
  throw "ffprobe fallo con codigo $ffprobeExit"
}

$probe = $probeJson | ConvertFrom-Json
$videoStream = $probe.streams | Where-Object { $_.codec_type -eq 'video' } | Select-Object -First 1
$audioStream = $probe.streams | Where-Object { $_.codec_type -eq 'audio' } | Select-Object -First 1

if (-not $videoStream) {
  throw 'No se encontro stream de video en el archivo generado.'
}
if ([int]$videoStream.width -ne 1280 -or [int]$videoStream.height -ne 720) {
  throw "Resolucion inesperada: $($videoStream.width)x$($videoStream.height)"
}
if ($videoStream.r_frame_rate -ne '30/1') {
  throw "FPS inesperado: $($videoStream.r_frame_rate)"
}
if ([int]$videoStream.nb_frames -ne 150) {
  throw "Numero de frames inesperado: $($videoStream.nb_frames)"
}

$hash = Get-FileHash -Algorithm SHA256 -Path $outFile
$fileInfo = Get-Item -Path $outFile

$summary = [ordered]@{
  file         = $outFile
  sizeBytes    = $fileInfo.Length
  sha256       = $hash.Hash
  formatName   = $probe.format.format_name
  formatDurationSec = [double]$probe.format.duration
  video        = [ordered]@{
    codec      = $videoStream.codec_name
    pixFmt     = $videoStream.pix_fmt
    width      = [int]$videoStream.width
    height     = [int]$videoStream.height
    rFrameRate = $videoStream.r_frame_rate
    nbFrames   = [int]$videoStream.nb_frames
    durationSec = [double]$videoStream.duration
  }
  audio        = if ($audioStream) {
    [ordered]@{
      codec      = $audioStream.codec_name
      sampleRate = [int]$audioStream.sample_rate
      channels   = [int]$audioStream.channels
      durationSec = [double]$audioStream.duration
    }
  } else {
    $null
  }
}

$summary | ConvertTo-Json -Depth 4

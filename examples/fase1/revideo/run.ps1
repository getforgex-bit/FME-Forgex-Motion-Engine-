# FDN-010: verificación repetible de Revideo. Uso: npm run verify   (o: powershell -File run.ps1)
# Hace: npm ci -> Chrome de Puppeteer (si falta) -> render MP4 y MOV con alpha -> ffprobe -> SHA-256 -> mide tiempo/RAM/VRAM.
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:DISABLE_TELEMETRY = 'true'                       # telemetría de Revideo desactivada
$env:PUPPETEER_CACHE_DIR = Join-Path $PSScriptRoot 'out/.puppeteer'
New-Item -ItemType Directory -Force out | Out-Null

if (-not (Test-Path node_modules)) { npm ci; if ($LASTEXITCODE) { throw 'npm ci falló' } }
if (-not (Test-Path $env:PUPPETEER_CACHE_DIR)) { npx puppeteer browsers install chrome; if ($LASTEXITCODE) { throw 'instalar Chrome falló' } }

function Get-Descendants([int]$rootPid) {
  $all = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, WorkingSetSize
  $ids = @($rootPid); $out = @(); $queue = @($rootPid)
  while ($queue.Count) { $p = $queue[0]; $queue = $queue[1..$queue.Count]
    foreach ($c in ($all | Where-Object ParentProcessId -eq $p)) { $out += $c; $queue += $c.ProcessId } }
  $out + ($all | Where-Object ProcessId -eq $rootPid)
}

function Invoke-Medido([string]$modo) {
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $p = Start-Process node -ArgumentList 'render.mjs', $modo -PassThru -NoNewWindow
  $pico = 0; $vram = 0
  while (-not $p.HasExited) {
    $ram = (Get-Descendants $p.Id | Measure-Object WorkingSetSize -Sum).Sum
    if ($ram -gt $pico) { $pico = $ram }
    $v = [int](nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | Select-Object -First 1)
    if ($v -gt $vram) { $vram = $v }
    Start-Sleep -Milliseconds 300
  }
  $sw.Stop()
  if ($p.ExitCode) { throw "render $modo falló (código $($p.ExitCode))" }
  [pscustomobject]@{ modo = $modo; segundos = [math]::Round($sw.Elapsed.TotalSeconds, 1); ram_pico_MB = [math]::Round($pico / 1MB); vram_total_usada_pico_MiB = $vram }
}

$base = [int](nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits | Select-Object -First 1)
$m = @((Invoke-Medido 'mp4'), (Invoke-Medido 'alpha'))
$m | Format-Table | Out-String | Write-Host
"VRAM base (antes de renderizar): $base MiB" | Write-Host

$frames = (ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 out/fme-revideo.mp4).Trim()
$fps = (ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 out/fme-revideo.mp4).Trim()
"MP4: frames=$frames fps=$fps (esperado 90 y 30/1)"
ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=codec_name,pix_fmt,nb_read_frames -of default=nw=1 out/alpha.mov
ffmpeg -v error -y -i out/alpha.mov -vf 'select=eq(n\,60)' -frames:v 1 out/alpha-frame60.png
python -I -c "from PIL import Image; im=Image.open('out/alpha-frame60.png'); print('alpha extrema fotograma 60:', im.getextrema()[3])"
Get-FileHash out/fme-revideo.mp4, out/alpha.mov -Algorithm SHA256 | ForEach-Object { "$($_.Hash)  $(Split-Path $_.Path -Leaf)" }
if ($frames -ne '90' -or $fps -ne '30/1') { throw "ACEPTACIÓN FALLIDA: frames=$frames fps=$fps" }
'ACEPTACIÓN OK: 90 fotogramas a 30 FPS'

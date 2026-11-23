[CmdletBinding()]
param(
    [string]$BlenderPath = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe',
    [string]$FfprobePath = 'ffprobe',
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_-]*$')]
    [string]$RunName = ('run-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss-fff'))
)

$ErrorActionPreference = 'Stop'
$blenderExe = (Get-Item -LiteralPath $BlenderPath).FullName
$ffprobeExe = (Get-Command $FfprobePath -CommandType Application | Select-Object -First 1).Source
if ((& $blenderExe --version | Select-Object -First 1) -notmatch '^Blender 5\.2(?:\.|\s|$)') {
    throw 'La prueba requiere Blender 5.2.'
}

$outRoot = Join-Path $PSScriptRoot 'out'
$null = [IO.Directory]::CreateDirectory($outRoot)
if ((Get-Item -LiteralPath $outRoot).Attributes -band [IO.FileAttributes]::ReparsePoint) {
    throw 'out debe ser un directorio local sin redirección.'
}
$output = (New-Item -Path $outRoot -Name $RunName -ItemType Directory).FullName
$scriptPath = Join-Path $PSScriptRoot 'render_scene.py'
$stdout = Join-Path $output 'blender.log'
$stderr = Join-Path $output 'blender.err.log'
$blenderArgs = @(
    '-b', '--factory-startup', '--disable-autoexec', '--python-exit-code', '1',
    '-P', ('"{0}"' -f $scriptPath), '--', ('"{0}"' -f $output)
)
$gpuLog = Join-Path $output 'gpu.csv'
$smi = Get-Command nvidia-smi -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
$sampler = $null
$process = $null
$peakWorkingSet = 0
$elapsed = [Diagnostics.Stopwatch]::StartNew()
try {
    if ($smi) {
        try {
            $sampler = Start-Process -FilePath $smi.Source -ArgumentList @(
                '--query-gpu=index,name,memory.used,memory.total',
                '--format=csv,noheader,nounits', '--loop-ms=1000'
            ) -WindowStyle Hidden -PassThru -RedirectStandardOutput $gpuLog `
                -RedirectStandardError (Join-Path $output 'gpu.err.log')
        } catch {
            Write-Warning "No se pudo iniciar nvidia-smi: $_"
        }
    }
    $process = Start-Process -FilePath $blenderExe -ArgumentList $blenderArgs `
        -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    while (-not $process.HasExited) {
        $process.Refresh()
        try {
            $peakWorkingSet = [Math]::Max($peakWorkingSet, $process.PeakWorkingSet64)
        } catch [InvalidOperationException] {
            if (-not $process.HasExited) { throw }
        }
        if ($elapsed.Elapsed.TotalMinutes -gt 15) {
            throw "Blender excedió 15 minutos. Consulta $stdout."
        }
        Start-Sleep -Milliseconds 250
    }
    $process.WaitForExit()
    if ($process.ExitCode -ne 0) {
        throw "Blender terminó con código $($process.ExitCode). Consulta $stdout y $stderr."
    }
} finally {
    $elapsed.Stop()
    foreach ($child in @($process, $sampler)) {
        if ($child) {
            if (-not $child.HasExited) { $child.Kill() }
            $child.WaitForExit()
            $child.Dispose()
        }
    }
}

$render = Get-Content -LiteralPath (Join-Path $output 'render.json') -Raw | ConvertFrom-Json
$probePath = Join-Path $output 'frame-%04d.png'
$probeJson = & $ffprobeExe -v error -f image2 -framerate 30 -start_number 1 `
    -i $probePath -count_frames -select_streams 'v:0' `
    -show_entries 'stream=width,height,pix_fmt,r_frame_rate,nb_read_frames' -of json
if ($LASTEXITCODE -ne 0) { throw 'ffprobe no pudo comprobar la secuencia.' }
$stream = ($probeJson | ConvertFrom-Json).streams[0]
if ($stream.pix_fmt -ne 'rgba' -or $stream.width -ne 960 -or $stream.height -ne 540 -or
    $stream.r_frame_rate -ne '30/1' -or $stream.nb_read_frames -ne '90' -or
    $render.fps -ne 30 -or $render.frameSeconds.Count -ne 90) {
    throw 'La secuencia no coincide con el formato de aceptación.'
}

Add-Type -AssemblyName System.Drawing
$centerColors = [Collections.Generic.HashSet[int]]::new()
$hashLines = foreach ($frame in 1..90) {
    $name = 'frame-{0:0000}.png' -f $frame
    $path = Join-Path $output $name
    $bitmap = [Drawing.Bitmap]::new($path)
    try {
        if ($bitmap.Width -ne 960 -or $bitmap.Height -ne 540) {
            throw "Dimensiones inesperadas en $name."
        }
        $center = $bitmap.GetPixel(480, 270)
        if ($bitmap.GetPixel(0, 0).A -ne 0 -or $center.A -ne 255) {
            throw "Valores alpha inesperados en $name."
        }
        $null = $centerColors.Add($center.ToArgb())
    } finally {
        $bitmap.Dispose()
    }
    "$((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant())  $name"
}
if ($centerColors.Count -lt 2) {
    throw 'Los fotogramas no muestran cambios.'
}

$manifest = Join-Path $output 'SHA256SUMS'
[IO.File]::WriteAllText($manifest, ($hashLines -join "`n") + "`n", [Text.Encoding]::ASCII)
$gpu = if (Test-Path -LiteralPath $gpuLog) {
    Get-Content -LiteralPath $gpuLog |
        ConvertFrom-Csv -Header 'Index','Name','UsedMiB','TotalMiB' |
        Where-Object { $_.UsedMiB -match '^\s*\d+\s*$' } |
        Group-Object -Property Index | ForEach-Object {
            [ordered]@{
                name = $_.Group[0].Name.Trim()
                sampleCount = $_.Count
                minUsedMiB = ($_.Group.UsedMiB | ForEach-Object { [int]$_ } | Measure-Object -Minimum).Minimum
                maxUsedMiB = ($_.Group.UsedMiB | ForEach-Object { [int]$_ } | Measure-Object -Maximum).Maximum
                totalMiB = [int]$_.Group[0].TotalMiB
            }
        }
}

$times = $render.frameSeconds | Measure-Object -Average -Minimum -Maximum
$report = [ordered]@{
    output = $output
    version = $render.version
    buildHash = $render.buildHash
    width = $stream.width
    height = $stream.height
    fps = $render.fps
    frames = [int]$stream.nb_read_frames
    pixelFormat = $stream.pix_fmt
    cornerAlpha = 0
    centerAlpha = 255
    distinctCenterColors = $centerColors.Count
    engine = $render.engine
    device = $render.device
    samples = $render.samples
    wallSeconds = [Math]::Round($elapsed.Elapsed.TotalSeconds, 3)
    meanFrameSeconds = [Math]::Round($times.Average, 4)
    minFrameSeconds = $times.Minimum
    maxFrameSeconds = $times.Maximum
    peakBlenderWorkingSetMiB = if ($peakWorkingSet) { [Math]::Round($peakWorkingSet / 1MB, 2) }
    gpuDeviceMemoryMiB = @($gpu | Where-Object { $null -ne $_ })
    manifestSha256 = (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.ToLowerInvariant()
}
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $output 'report.json') -Encoding UTF8
$report | ConvertTo-Json -Depth 4

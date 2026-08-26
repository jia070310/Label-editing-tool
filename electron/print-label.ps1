param(
  [Parameter(Mandatory=$true)][string]$ImagePath,
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][double]$WidthMm,
  [Parameter(Mandatory=$true)][double]$HeightMm,
  [string]$LogPath = ""
)

function Write-PrintLog([string]$Message) {
  $line = "$(Get-Date -Format o) [PS] $Message"
  Write-Output $line
  if ($LogPath) {
    try { Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 } catch {}
  }
}

Add-Type -AssemblyName System.Drawing

$wHundredths = [int][Math]::Round($WidthMm / 25.4 * 100)
$hHundredths = [int][Math]::Round($HeightMm / 25.4 * 100)
if ($wHundredths -lt 1) { $wHundredths = 1 }
if ($hHundredths -lt 1) { $hHundredths = 1 }

Write-PrintLog "start printer='$PrinterName' sizeMm=${WidthMm}x${HeightMm} hundredths=${wHundredths}x${hHundredths}"
Write-PrintLog "image='$ImagePath' exists=$([IO.File]::Exists($ImagePath))"

$img = $null
$doc = $null
try {
  $img = [System.Drawing.Image]::FromFile($ImagePath)
  Write-PrintLog ("image loaded {0}x{1}" -f $img.Width, $img.Height)

  $doc = New-Object System.Drawing.Printing.PrintDocument
  $doc.DocumentName = "LabelPrint"
  $doc.PrinterSettings.PrinterName = $PrinterName
  Write-PrintLog "printer IsValid=$($doc.PrinterSettings.IsValid) status=$($doc.PrinterSettings.PrinterStatus)"

  if (-not $doc.PrinterSettings.IsValid) {
    throw "Invalid printer: $PrinterName"
  }

  $paper = $null
  $paperSource = "none"
  foreach ($ps in $doc.PrinterSettings.PaperSizes) {
    if ([Math]::Abs($ps.Width - $wHundredths) -le 8 -and [Math]::Abs($ps.Height - $hHundredths) -le 8) {
      $paper = $ps
      $paperSource = "driver:$($ps.PaperName)"
      break
    }
  }
  if ($null -eq $paper) {
    $paper = New-Object System.Drawing.Printing.PaperSize("LabelCustom", $wHundredths, $hHundredths)
    try { $paper.RawKind = 256 } catch {}
    $paperSource = "custom"
  }
  Write-PrintLog "paper source=$paperSource kind=$($paper.Kind) raw=$($paper.RawKind) size=$($paper.Width)x$($paper.Height)"

  try {
    $doc.DefaultPageSettings.PaperSize = $paper
  } catch {
    Write-PrintLog "set custom paper failed: $($_.Exception.Message); fallback to default paper"
    $paper = $doc.DefaultPageSettings.PaperSize
  }
  $doc.DefaultPageSettings.Landscape = $false
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $doc.OriginAtMargins = $false

  $renderState = @{ Done = $false; Bounds = ""; Error = "" }
  $doc.add_PrintPage({
    param($sender, $e)
    try {
      $bounds = $e.PageBounds
      if ($bounds.Width -lt 1 -or $bounds.Height -lt 1) {
        $bounds = New-Object System.Drawing.Rectangle(0, 0, $wHundredths, $hHundredths)
      }
      $renderState.Bounds = "$($bounds.X),$($bounds.Y) $($bounds.Width)x$($bounds.Height)"
      $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $e.Graphics.DrawImage($img, $bounds)
      $e.HasMorePages = $false
      $renderState.Done = $true
    } catch {
      $renderState.Error = $_.Exception.Message
      throw
    }
  }.GetNewClosure())

  $doc.add_QueryPageSettings({
    param($sender, $e)
    Write-PrintLog "QueryPageSettings paper=$($e.PageSettings.PaperSize.Width)x$($e.PageSettings.PaperSize.Height)"
  }.GetNewClosure())

  Write-PrintLog "calling Print()"
  $doc.Print()
  Write-PrintLog "Print() returned Done=$($renderState.Done) Bounds=$($renderState.Bounds) Err=$($renderState.Error)"

  if (-not $renderState.Done) {
    Write-PrintLog "WARN PrintPage callback was not observed; spooler may still have accepted the job."
  }

  $portName = ""
  try {
    $pInfo = Get-Printer -Name $PrinterName -ErrorAction Stop
    $portName = [string]$pInfo.PortName
    Write-PrintLog ("printer PortName={0} PrinterStatus={1}" -f $portName, $pInfo.PrinterStatus)
  } catch {
    Write-PrintLog ("Get-Printer failed: {0}" -f $_.Exception.Message)
  }

  if ($portName -match '^(COM\d+)') {
    $com = $Matches[1]
    $comOk = $false
    try {
      $ports = [System.IO.Ports.SerialPort]::GetPortNames()
      $comOk = $ports -contains $com
      Write-PrintLog ("serial ports=[{0}] target={1} present={2}" -f ($ports -join ','), $com, $comOk)
    } catch {
      Write-PrintLog ("list serial ports failed: {0}" -f $_.Exception.Message)
    }
    if (-not $comOk) {
      throw ("打印机端口 {0} 不可用（设备未连接或端口已变更）。请检查 POSLABEL 电源/数据线，并在 Windows 打印机属性中确认端口。" -f $portName)
    }
  }

  Start-Sleep -Milliseconds 800
  try {
    $jobs = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue | Where-Object {
      $_.DocumentName -eq 'LabelPrint'
    } | Sort-Object Id -Descending)
    if ($jobs.Count -gt 0) {
      $job = $jobs[0]
      Write-PrintLog ("job Id={0} Status={1} PagesPrinted={2} Size={3}" -f $job.Id, $job.JobStatus, $job.PagesPrinted, $job.Size)
      $st = [string]$job.JobStatus
      if ($st -match 'Error|失败') {
        throw ("打印机队列报错（作业 {0}：{1}）。多为设备离线、缺纸、端口不通或纸张尺寸与实物不符，不是编辑器渲染失败。" -f $job.Id, $st)
      }
    } else {
      Write-PrintLog "no retained LabelPrint job in queue (likely completed or auto-deleted)"
    }
  } catch {
    if ($_.Exception.Message -match '打印机队列报错|端口') { throw }
    Write-PrintLog ("Get-PrintJob check skipped: {0}" -f $_.Exception.Message)
  }

  Write-Output "OK"
  exit 0
} catch {
  $msg = $_.Exception.Message
  if (-not $msg) { $msg = $_.ToString() }
  Write-PrintLog "ERROR $msg"
  if ($_.ScriptStackTrace) { Write-PrintLog "STACK $($_.ScriptStackTrace)" }
  [Console]::Error.WriteLine("PRINT_ERROR: $msg")
  exit 3
} finally {
  if ($null -ne $img) { $img.Dispose() }
  if ($null -ne $doc) { $doc.Dispose() }
}

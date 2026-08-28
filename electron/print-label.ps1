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
    Write-PrintLog "DefaultPageSettings set paper failed: $($_.Exception.Message); will force in QueryPageSettings"
  }
  $doc.DefaultPageSettings.Landscape = $false
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $doc.OriginAtMargins = $false
  $doc.PrinterSettings.Copies = 1
  try { $doc.PrinterSettings.Collate = $false } catch {}
  $doc.PrintController = New-Object System.Drawing.Printing.StandardPrintController

  $renderState = @{ Done = $false; Bounds = ""; Error = "" }
  $doc.add_PrintPage({
    param($sender, $e)
    try {
      if ($renderState.Done) {
        $e.HasMorePages = $false
        return
      }
      # 标签机硬边距：Graphics(0,0) 在可打印区左上角。先移回纸张原点再满幅绘制，
      # 并略微内缩，避免顶/底边框落在不可打印区被裁掉。
      $hardX = 0
      $hardY = 0
      try {
        $hardX = [int][Math]::Round($e.PageSettings.HardMarginX)
        $hardY = [int][Math]::Round($e.PageSettings.HardMarginY)
      } catch {}
      $pw = $e.PageSettings.PaperSize.Width
      $ph = $e.PageSettings.PaperSize.Height
      if ($pw -lt 1 -or [Math]::Abs($pw - $wHundredths) -gt 8) { $pw = $wHundredths }
      if ($ph -lt 1 -or [Math]::Abs($ph - $hHundredths) -gt 8) { $ph = $hHundredths }
      if ($hardX -ne 0 -or $hardY -ne 0) {
        $e.Graphics.TranslateTransform(-$hardX, -$hardY)
      }
      # 约 0.5mm 内缩（单位：百分之一英寸）
      $inset = 2
      $dw = [Math]::Max(1, $pw - 2 * $inset)
      $dh = [Math]::Max(1, $ph - 2 * $inset)
      $bounds = New-Object System.Drawing.Rectangle($inset, $inset, $dw, $dh)
      $renderState.Bounds = ('{0},{0} {1}x{2} hard={3},{4} paper={5}x{6}' -f $inset, $dw, $dh, $hardX, $hardY, $pw, $ph)
      $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
      $e.Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
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
    try {
      $e.PageSettings.PaperSize = $paper
      $e.PageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
      $e.PageSettings.Landscape = $false
    } catch {
      Write-PrintLog "QueryPageSettings set paper failed: $($_.Exception.Message)"
    }
    Write-PrintLog "QueryPageSettings paper=$($e.PageSettings.PaperSize.PaperName) $($e.PageSettings.PaperSize.Width)x$($e.PageSettings.PaperSize.Height)"
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
      throw ("PRINTER_PORT_UNAVAILABLE: {0}" -f $portName)
    }
  }

  Start-Sleep -Milliseconds 800
  try {
    $jobs = @(Get-PrintJob -PrinterName $PrinterName -ErrorAction SilentlyContinue | Where-Object {
      $_.DocumentName -eq 'LabelPrint'
    } | Sort-Object Id -Descending)
    if ($jobs.Count -gt 0) {
      $job = $jobs[0]
      Write-PrintLog ('job Id={0} Status={1} PagesPrinted={2} Size={3}' -f $job.Id, $job.JobStatus, $job.PagesPrinted, $job.Size)
      $st = [string]$job.JobStatus
      if ($st -match 'Error|Failed|失败') {
        throw ('PRINTER_QUEUE_ERROR: job={0}; status={1}' -f $job.Id, $st)
      }
    } else {
      Write-PrintLog 'no retained LabelPrint job in queue (likely completed or auto-deleted)'
    }
  } catch {
    if ($_.Exception.Message -match 'PRINTER_QUEUE_ERROR|PRINTER_PORT_UNAVAILABLE') { throw }
    Write-PrintLog ('Get-PrintJob check skipped: {0}' -f $_.Exception.Message)
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

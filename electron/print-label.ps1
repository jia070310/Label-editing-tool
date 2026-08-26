param(
  [Parameter(Mandatory=$true)][string]$ImagePath,
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][double]$WidthMm,
  [Parameter(Mandatory=$true)][double]$HeightMm
)

Add-Type -AssemblyName System.Drawing

$wHundredths = [int][Math]::Round($WidthMm / 25.4 * 100)
$hHundredths = [int][Math]::Round($HeightMm / 25.4 * 100)
if ($wHundredths -lt 1) { $wHundredths = 1 }
if ($hHundredths -lt 1) { $hHundredths = 1 }

$img = $null
$doc = $null
try {
  $img = [System.Drawing.Image]::FromFile($ImagePath)
  $doc = New-Object System.Drawing.Printing.PrintDocument
  $doc.DocumentName = "LabelPrint"
  $doc.PrinterSettings.PrinterName = $PrinterName

  if (-not $doc.PrinterSettings.IsValid) {
    throw "Invalid printer: $PrinterName"
  }

  $paper = $null
  foreach ($ps in $doc.PrinterSettings.PaperSizes) {
    if ([Math]::Abs($ps.Width - $wHundredths) -le 8 -and [Math]::Abs($ps.Height - $hHundredths) -le 8) {
      $paper = $ps
      break
    }
  }
  if ($null -eq $paper) {
    $paper = New-Object System.Drawing.Printing.PaperSize("LabelCustom", $wHundredths, $hHundredths)
  }
  $doc.DefaultPageSettings.PaperSize = $paper
  $doc.DefaultPageSettings.Landscape = $false
  $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0, 0, 0, 0)
  $doc.OriginAtMargins = $false

  $renderState = @{ Done = $false }
  $doc.add_PrintPage({
    param($sender, $e)
    $bounds = $e.PageBounds
    if ($bounds.Width -lt 1 -or $bounds.Height -lt 1) {
      $bounds = New-Object System.Drawing.Rectangle(0, 0, $wHundredths, $hHundredths)
    }
    $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $e.Graphics.DrawImage($img, $bounds)
    $e.HasMorePages = $false
    $renderState.Done = $true
  }.GetNewClosure())

  $doc.Print()
  if (-not $renderState.Done) {
    Write-Warning "PrintPage callback was not observed; spooler may still have accepted the job."
  }
  Write-Output "OK"
  exit 0
} catch {
  Write-Error $_.Exception.Message
  exit 3
} finally {
  if ($null -ne $img) { $img.Dispose() }
  if ($null -ne $doc) { $doc.Dispose() }
}

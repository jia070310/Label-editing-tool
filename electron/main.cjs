const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')

const APP_DISPLAY_NAME = '柠檬标签工具'
const isDev = !app.isPackaged
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {BrowserWindow | null} */
let splashWindow = null

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {Promise<string>}
 */
function runCapture(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      env: { ...process.env },
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => {
      out += d.toString('utf8')
    })
    child.stderr.on('data', (d) => {
      err += d.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else reject(new Error(err || `${command} exited ${code}`))
    })
  })
}

/** @returns {Promise<string[]>} */
async function listWindowsFonts() {
  // 避免依赖 $变量，降低嵌套转义后被吞掉的风险
  const ps =
    "Add-Type -AssemblyName System.Drawing; " +
    "[System.Drawing.Text.InstalledFontCollection]::new().Families | " +
    "ForEach-Object -MemberName Name | ConvertTo-Json -Compress"
  const out = await runCapture('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    ps,
  ])
  const trimmed = out.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    if (Array.isArray(parsed)) return parsed.map(String)
    if (typeof parsed === 'string') return [parsed]
    return []
  } catch {
    return trimmed
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }
}

/** @returns {Promise<string[]>} */
async function listMacFonts() {
  try {
    const out = await runCapture('system_profiler', [
      'SPFontsDataType',
      '-json',
    ])
    const data = JSON.parse(out)
    const fonts = data?.SPFontsDataType || []
    const names = []
    for (const f of fonts) {
      const family = f?.typefaces?.[0]?.family || f?._name
      if (family) names.push(String(family))
    }
    return names
  } catch {
    return []
  }
}

/** @returns {Promise<string[]>} */
async function listLinuxFonts() {
  try {
    const out = await runCapture('fc-list', [':', 'family'])
    return out
      .split(/\r?\n/)
      .flatMap((line) =>
        line
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      )
  } catch {
    return []
  }
}

/** @returns {Promise<string[]>} */
function listSystemFonts() {
  if (process.platform === 'win32') return listWindowsFonts()
  if (process.platform === 'darwin') return listMacFonts()
  return listLinuxFonts()
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 280,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#151922',
    show: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  splashWindow.setMenuBarVisibility(false)
  splashWindow.loadFile(path.join(__dirname, 'splash.html')).catch((err) => {
    console.error('启动页加载失败', err)
  })

  splashWindow.on('closed', () => {
    splashWindow = null
  })
}

function closeSplash() {
  if (!splashWindow || splashWindow.isDestroyed()) {
    splashWindow = null
    return
  }
  try {
    splashWindow.close()
  } catch {
    /* ignore */
  }
  splashWindow = null
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: APP_DISPLAY_NAME,
    show: false,
    backgroundColor: '#151922',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  let shown = false
  const revealMain = () => {
    if (shown || !mainWindow || mainWindow.isDestroyed()) return
    shown = true
    mainWindow.show()
    mainWindow.focus()
    // 稍等主窗口上屏后再关启动页，避免闪白
    setTimeout(closeSplash, 120)
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('页面加载失败', code, desc, url)
    appendAppLog('did-fail-load', { code, desc, url })
    if (isDev && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(() => {
        mainWindow?.loadURL(devServerUrl).catch(() => {})
      }, 800)
    } else {
      // 生产环境加载失败也要露出窗口，避免卡在启动页
      revealMain()
    }
  })

  mainWindow.once('ready-to-show', revealMain)
  mainWindow.webContents.on('did-finish-load', () => {
    // ready-to-show 偶发不触发时兜底
    setTimeout(revealMain, 50)
  })

  if (isDev) {
    mainWindow.loadURL(devServerUrl).catch((err) => console.error(err))
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    closeSplash()
  })
}

function getPrintWorkDir() {
  const dir = path.join(os.tmpdir(), 'lemon-label-tool')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function getLegacyPrintWorkDir() {
  return path.join(os.tmpdir(), 'label-print-editor')
}

function getLogDir() {
  try {
    if (app.isReady()) {
      const dir = path.join(app.getPath('userData'), 'logs')
      fs.mkdirSync(dir, { recursive: true })
      return dir
    }
  } catch {
    /* ignore */
  }
  return getPrintWorkDir()
}

function getPrintLogPath() {
  return path.join(getPrintWorkDir(), 'print.log')
}

function getAppLogPath() {
  return path.join(getLogDir(), 'app.log')
}

function appendAppLog(message, extra) {
  const line = `[${new Date().toISOString()}] ${message}`
  const block =
    extra === undefined
      ? `${line}\n`
      : `${line}\n${typeof extra === 'string' ? extra : JSON.stringify(extra, null, 2)}\n`
  try {
    fs.appendFileSync(getAppLogPath(), block, 'utf8')
  } catch (err) {
    console.error('[app-log]', err)
  }
  console.log('[app]', message, extra ?? '')
}

function appendPrintLog(message, extra) {
  const line = `[${new Date().toISOString()}] ${message}`
  const block =
    extra === undefined
      ? `${line}\n`
      : `${line}\n${typeof extra === 'string' ? extra : JSON.stringify(extra, null, 2)}\n`
  try {
    fs.appendFileSync(getPrintLogPath(), block, 'utf8')
  } catch (err) {
    console.error('[print-log]', err)
  }
  try {
    fs.appendFileSync(getAppLogPath(), `[print] ${block}`, 'utf8')
  } catch {
    /* ignore */
  }
  console.log('[print]', message, extra ?? '')
}

function readTail(filePath, maxBytes = 120_000) {
  try {
    if (!fs.existsSync(filePath)) return '(无)'
    const stat = fs.statSync(filePath)
    if (stat.size <= maxBytes) return fs.readFileSync(filePath, 'utf8')
    const fd = fs.openSync(filePath, 'r')
    try {
      const buf = Buffer.alloc(maxBytes)
      fs.readSync(fd, buf, 0, maxBytes, Math.max(0, stat.size - maxBytes))
      return `...(已截断较早内容)\n${buf.toString('utf8')}`
    } finally {
      fs.closeSync(fd)
    }
  } catch (err) {
    return `(读取失败: ${err.message})`
  }
}

async function collectPrinterSummary() {
  if (!mainWindow) return []
  try {
    const list = await mainWindow.webContents.getPrintersAsync()
    return (list || []).map((p) => ({
      name: p.name,
      displayName: p.displayName,
      isDefault: p.isDefault,
      status: p.status,
    }))
  } catch (err) {
    return [{ error: err.message }]
  }
}

async function exportFeedbackBundle() {
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)
  const defaultName = `柠檬标签工具-反馈日志-${stamp}.txt`
  const { canceled, filePath } = await dialog.showSaveDialog(
    mainWindow || undefined,
    {
      title: '导出反馈日志',
      defaultPath: path.join(app.getPath('desktop'), defaultName),
      filters: [{ name: '文本日志', extensions: ['txt'] }],
    },
  )
  if (canceled || !filePath) {
    return { ok: false, cancelled: true }
  }

  const printers = await collectPrinterSummary()
  const legacyPrintLog = path.join(getLegacyPrintWorkDir(), 'print.log')
  const body = [
    `=== ${APP_DISPLAY_NAME} · 反馈日志（仅本机导出，不联网） ===`,
    `导出时间: ${new Date().toLocaleString('zh-CN')}`,
    `应用版本: ${app.getVersion()}`,
    `打包状态: ${app.isPackaged ? 'installed' : 'dev'}`,
    `系统: ${os.type()} ${os.release()} (${os.arch()})`,
    `用户名: ${os.userInfo().username}`,
    `临时目录: ${getPrintWorkDir()}`,
    `日志目录: ${getLogDir()}`,
    '',
    '--- 打印机列表 ---',
    JSON.stringify(printers, null, 2),
    '',
    '--- 应用日志 (app.log) ---',
    readTail(getAppLogPath()),
    '',
    '--- 打印日志 (print.log) ---',
    readTail(getPrintLogPath()),
    '',
    '--- 旧版打印日志 (兼容) ---',
    readTail(legacyPrintLog),
    '',
    '=== 结束 ===',
    '',
  ].join('\n')

  fs.writeFileSync(filePath, body, 'utf8')
  appendAppLog('feedback exported', { filePath })
  return { ok: true, path: filePath }
}

function dataUrlToPngFile(dataUrl, filePath) {
  const m = /^data:image\/\w+;base64,(.+)$/.exec(dataUrl)
  if (!m) throw new Error('无效的标签图像')
  fs.writeFileSync(filePath, Buffer.from(m[1], 'base64'))
}

const PRINT_PS1 = String.raw`
param(
  [Parameter(Mandatory=$true)][string]$ImagePath,
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][double]$WidthMm,
  [Parameter(Mandatory=$true)][double]$HeightMm,
  [int]$Copies = 1,
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

if ($Copies -lt 1) { $Copies = 1 }
if ($Copies -gt 999) { $Copies = 999 }

$wHundredths = [int][Math]::Round($WidthMm / 25.4 * 100)
$hHundredths = [int][Math]::Round($HeightMm / 25.4 * 100)
if ($wHundredths -lt 1) { $wHundredths = 1 }
if ($hHundredths -lt 1) { $hHundredths = 1 }

Write-PrintLog ("start printer='{0}' sizeMm={1}x{2} hundredths={3}x{4} copies={5}" -f $PrinterName, $WidthMm, $HeightMm, $wHundredths, $hHundredths, $Copies)
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
  $doc.PrinterSettings.Copies = [int16]$Copies
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

  # 交作业成功不等于设备打印成功：检查端口与队列错误
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
`

function normalizePrintError(raw) {
  const text = String(raw || '').trim()
  if (!text) return '打印失败'
  if (/Print page was not rendered/i.test(text)) {
    return '打印任务已发送，但驱动未返回渲染确认'
  }

  const marked = text.match(/PRINT_ERROR:\s*(.+)/i)
  if (marked?.[1]) {
    const msg = marked[1].trim()
    if (/^PRINTER_PORT_UNAVAILABLE:/i.test(msg)) {
      const port = msg.replace(/^PRINTER_PORT_UNAVAILABLE:\s*/i, '')
      return `打印机端口 ${port} 不可用（设备未连接或端口已变更）。请检查 POSLABEL 电源/数据线，并在 Windows 打印机属性中确认端口。`
    }
    if (/^PRINTER_QUEUE_ERROR:/i.test(msg)) {
      const detail = msg.replace(/^PRINTER_QUEUE_ERROR:\s*/i, '')
      return `打印机队列报错（${detail}）。多为设备离线、缺纸、端口不通或纸张尺寸与实物不符。`
    }
    return msg.slice(0, 240)
  }

  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(
      (s) =>
        !/FullyQualifiedErrorId|CategoryInfo|WriteErrorException|^\+\s|At\s+.+\.ps1/i.test(
          s,
        ),
    )

  for (const line of lines) {
    const m = line.match(/\.ps1\s*:\s*(.+)$/i)
    if (m?.[1]) return m[1].trim().slice(0, 240)
    const psErr = line.match(/\[PS\] ERROR\s+(.+)$/i)
    if (psErr?.[1]) return psErr[1].trim().slice(0, 240)
  }

  const fallback = lines[0] || text
  return fallback.replace(/^.*?:\s*/, '').slice(0, 240)
}

function writeUtf8BomFile(filePath, content) {
  // Windows PowerShell 5.1 无 BOM 时按系统 ANSI 读脚本，中文会截断字符串导致解析失败
  fs.writeFileSync(filePath, `\uFEFF${content}`, 'utf8')
}

function runPowershellPrint(imagePath, printerName, widthMm, heightMm, copies = 1) {
  const tmpDir = getPrintWorkDir()
  const logPath = getPrintLogPath()
  // 写到纯 ASCII 临时路径，避免中文项目路径导致 PS 解析失败
  const scriptPath = path.join(tmpDir, 'print-label-run.ps1')
  writeUtf8BomFile(scriptPath, PRINT_PS1)
  const copyCount = Math.min(999, Math.max(1, Math.floor(Number(copies)) || 1))

  appendPrintLog('spawn powershell', {
    scriptPath,
    imagePath,
    printerName,
    widthMm,
    heightMm,
    copies: copyCount,
    logPath,
  })

  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        scriptPath,
        '-ImagePath',
        imagePath,
        '-PrinterName',
        printerName,
        '-WidthMm',
        String(widthMm),
        '-HeightMm',
        String(heightMm),
        '-Copies',
        String(copyCount),
        '-LogPath',
        logPath,
      ],
      { windowsHide: true },
    )

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      const chunk = d.toString()
      stdout += chunk
      appendPrintLog(`ps.stdout ${chunk.trim()}`)
    })
    child.stderr.on('data', (d) => {
      const chunk = d.toString()
      stderr += chunk
      appendPrintLog(`ps.stderr ${chunk.trim()}`)
    })
    child.on('error', (err) => {
      appendPrintLog('spawn error', { message: err.message })
      reject(err)
    })
    child.on('close', (code) => {
      appendPrintLog(`powershell exit code=${code}`, {
        stdout: stdout.slice(-2000),
        stderr: stderr.slice(-2000),
      })
      if (code === 0) resolve({ ok: true, stdout, logPath })
      else {
        const msg = normalizePrintError(stderr || stdout)
        const err = new Error(
          `${msg || `print failed code=${code}`}（日志: ${logPath}）`,
        )
        err.logPath = logPath
        reject(err)
      }
    })
  })
}

/**
 * Windows：用 GDI 按毫米纸张打印 PNG 并铺满整页（真正 1:1 满铺）
 * 其它平台：回退 Electron print
 */
async function printLabelPayload(payload) {
  const {
    dataUrl,
    widthMm,
    heightMm,
    dpi = 203,
    copies = 1,
    deviceName = '',
    silent = false,
  } = payload

  const pageW = Number(widthMm)
  const pageH = Number(heightMm)
  const printDpi = Number(dpi) || 203
  const copyCount = Math.min(999, Math.max(1, Math.floor(Number(copies)) || 1))
  const logPath = getPrintLogPath()

  appendPrintLog('========== print-label start ==========', {
    widthMm: pageW,
    heightMm: pageH,
    dpi: printDpi,
    copies: copyCount,
    deviceName,
    silent,
    dataUrlBytes: dataUrl ? dataUrl.length : 0,
    platform: process.platform,
  })

  if (!dataUrl || !(pageW > 0) || !(pageH > 0)) {
    appendPrintLog('invalid params')
    throw new Error(`打印参数无效（日志: ${logPath}）`)
  }

  const tmpDir = getPrintWorkDir()
  const tmpPng = path.join(tmpDir, `label-${Date.now()}.png`)
  dataUrlToPngFile(dataUrl, tmpPng)
  const pngStat = fs.statSync(tmpPng)
  appendPrintLog('png written', { tmpPng, bytes: pngStat.size })

  try {
    if (process.platform === 'win32') {
      let printer = deviceName
      if (!printer && mainWindow) {
        try {
          const list = await mainWindow.webContents.getPrintersAsync()
          appendPrintLog(
            'printer list',
            list.map((p) => ({
              name: p.name,
              displayName: p.displayName,
              isDefault: p.isDefault,
              status: p.status,
            })),
          )
          const def = list.find((p) => p.isDefault) || list[0]
          printer = def?.name || ''
        } catch (err) {
          appendPrintLog('getPrinters failed', { message: err.message })
          printer = ''
        }
      }
      if (!printer) {
        appendPrintLog('no printer selected')
        throw new Error(
          `未找到打印机，请在打印对话框中选择打印机（日志: ${logPath}）`,
        )
      }

      appendPrintLog('selected printer', { printer, copies: copyCount })
      await runPowershellPrint(tmpPng, printer, pageW, pageH, copyCount)
      appendPrintLog('print-label success gdi-fullbleed')
      return { ok: true, cancelled: false, method: 'gdi-fullbleed', logPath }
    }

    const result = await printViaElectronFallback({
      dataUrl,
      pageW,
      pageH,
      printDpi,
      copies: copyCount,
      deviceName,
      silent,
    })
    appendPrintLog('print-label success electron', result)
    return { ...result, logPath }
  } catch (err) {
    appendPrintLog('print-label failed', {
      message: err?.message || String(err),
      stack: err?.stack,
    })
    const msg = err?.message || '打印失败'
    if (!String(msg).includes('日志:')) {
      const wrapped = new Error(`${msg}（日志: ${logPath}）`)
      wrapped.logPath = logPath
      throw wrapped
    }
    throw err
  } finally {
    setTimeout(() => {
      try {
        fs.unlinkSync(tmpPng)
      } catch {
        /* ignore */
      }
    }, 60000)
  }
}

async function printViaElectronFallback({
  dataUrl,
  pageW,
  pageH,
  printDpi,
  copies = 1,
  deviceName,
  silent,
}) {
  const micronsW = Math.round(pageW * 1000)
  const micronsH = Math.round(pageH * 1000)
  const cssPxPerMm = 96 / 25.4
  const winW = Math.max(120, Math.ceil(pageW * cssPxPerMm) + 16)
  const winH = Math.max(120, Math.ceil(pageH * cssPxPerMm) + 16)

  const renderWin = new BrowserWindow({
    width: winW,
    height: winH,
    show: false,
    frame: false,
    backgroundColor: '#ffffff',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  })

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@page{size:${pageW}mm ${pageH}mm;margin:0}
*{margin:0;padding:0}
html,body{width:${pageW}mm;height:${pageH}mm;overflow:hidden;background:#fff}
img{position:absolute;left:0;top:0;width:${pageW}mm!important;height:${pageH}mm!important;object-fit:fill}
</style></head><body><img id="label" src="${dataUrl}"/></body></html>`

  await renderWin.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  )
  await renderWin.webContents.executeJavaScript(`new Promise(r=>{
    const i=document.getElementById('label');
    if(!i) return r(false);
    if(i.complete&&i.naturalWidth) return r(true);
    i.onload=()=>r(true); i.onerror=()=>r(false);
    setTimeout(()=>r(true),2000);
  })`)

  const printOptions = {
    silent: !!silent,
    printBackground: true,
    margins: { marginType: 'none' },
    scaleFactor: 100,
    copies: Math.min(999, Math.max(1, Math.floor(Number(copies)) || 1)),
    pageSize: { width: micronsW, height: micronsH },
    dpi: { horizontal: printDpi, vertical: printDpi },
  }
  if (deviceName) printOptions.deviceName = deviceName

  try {
    const result = await new Promise((resolve) => {
      renderWin.webContents.print(printOptions, (success, failureReason) => {
        resolve({ success: !!success, failureReason: failureReason || '' })
      })
    })
    if (!result.success && result.failureReason && !/cancel/i.test(result.failureReason)) {
      throw new Error(result.failureReason)
    }
    return {
      ok: true,
      cancelled: !result.success,
      method: 'electron',
    }
  } finally {
    renderWin.destroy()
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  appendAppLog('app ready', {
    version: app.getVersion(),
    packaged: app.isPackaged,
    platform: process.platform,
  })
  createSplash()
  createWindow()

  ipcMain.handle('print-label', async (_event, payload) => {
    return printLabelPayload(payload)
  })

  ipcMain.handle('get-printers', async () => {
    if (!mainWindow) return []
    try {
      return await mainWindow.webContents.getPrintersAsync()
    } catch {
      return []
    }
  })

  ipcMain.handle('get-print-log-path', async () => getPrintLogPath())

  ipcMain.handle('open-print-log', async () => {
    const logPath = getPrintLogPath()
    if (!fs.existsSync(logPath)) {
      appendPrintLog('log file created on open')
    }
    const err = await shell.openPath(logPath)
    if (err) {
      await shell.openPath(getPrintWorkDir())
      return { ok: false, path: logPath, error: err }
    }
    return { ok: true, path: logPath }
  })

  ipcMain.handle('report-client-error', async (_event, payload) => {
    appendAppLog('client-error', payload || {})
    return { ok: true }
  })

  ipcMain.handle('export-feedback-log', async () => {
    return exportFeedbackBundle()
  })

  ipcMain.handle('save-text-file', async (_event, payload = {}) => {
    const defaultName = payload.defaultPath || 'export.txt'
    const { canceled, filePath } = await dialog.showSaveDialog(
      mainWindow || undefined,
      {
        title: payload.title || '保存文件',
        defaultPath: path.isAbsolute(defaultName)
          ? defaultName
          : path.join(app.getPath('desktop'), defaultName),
        filters: Array.isArray(payload.filters) && payload.filters.length
          ? payload.filters
          : [{ name: '文本', extensions: ['txt'] }],
      },
    )
    if (canceled || !filePath) return { ok: false, cancelled: true }
    fs.writeFileSync(filePath, String(payload.content ?? ''), 'utf8')
    return { ok: true, path: filePath }
  })

  ipcMain.handle('get-system-fonts', async () => {
    try {
      return await listSystemFonts()
    } catch (err) {
      appendAppLog('get-system-fonts failed', {
        message: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  })

  ipcMain.handle('get-app-version', async () => app.getVersion())

  ipcMain.handle('open-external', async (_event, url) => {
    const target = String(url || '').trim()
    if (!/^https?:\/\//i.test(target)) {
      return { ok: false, error: 'invalid url' }
    }
    try {
      await shell.openExternal(target)
      return { ok: true }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  })

  ipcMain.handle('translate-text', async (_event, text) => {
    const q = String(text || '').trim()
    if (!q) return { ok: false, error: 'empty' }

    // 与渲染进程一致：计量单位先换成英文简称，避免「尺」被译成 foot/feet
    const prepared = q
      .replace(/[/／]\s*尺/g, '/ft')
      .replace(/(\d+(?:\.\d+)?)\s*尺(?!子)/g, '$1 ft')
      .replace(/[/／]\s*米(?![厘毫])/g, '/m')
      .replace(/(\d+(?:\.\d+)?)\s*米(?![厘毫])/g, '$1 m')
      .replace(/[/／]\s*厘米/g, '/cm')
      .replace(/(\d+(?:\.\d+)?)\s*厘米/g, '$1 cm')
      .replace(/[/／]\s*毫米/g, '/mm')
      .replace(/(\d+(?:\.\d+)?)\s*毫米/g, '$1 mm')

    const normalizeEn = (raw) =>
      String(raw || '')
        .replace(/[/／]\s*feet?\b/gi, '/ft')
        .replace(/\b(\d+(?:\.\d+)?)\s*\/\s*feet?\b/gi, '$1/ft')
        .replace(/\b(\d+(?:\.\d+)?)\s+feet?\b/gi, '$1 ft')
        .replace(/\bper\s+feet?\b/gi, '/ft')
        .replace(/\bchi\b/gi, 'ft')
        .replace(/[/／]\s*metres?\b/gi, '/m')
        .replace(/[/／]\s*meters?\b/gi, '/m')
        .replace(/[/／]\s*centimet(?:re|er)s?\b/gi, '/cm')
        .replace(/[/／]\s*millimet(?:re|er)s?\b/gi, '/mm')
        .replace(/\s{2,}/g, ' ')
        .trim()

    const fetchJson = async (url, timeoutMs = 10000) => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return await res.json()
      } finally {
        clearTimeout(timer)
      }
    }

    try {
      const gUrl =
        'https://translate.googleapis.com/translate_a/single?' +
        new URLSearchParams({
          client: 'gtx',
          sl: 'zh-CN',
          tl: 'en',
          dt: 't',
          q: prepared,
        })
      const data = await fetchJson(gUrl)
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const parts = []
        for (const chunk of data[0]) {
          if (Array.isArray(chunk) && typeof chunk[0] === 'string') {
            parts.push(chunk[0])
          }
        }
        const translated = normalizeEn(parts.join(''))
        if (translated) {
          return { ok: true, text: translated, provider: 'google' }
        }
      }
      throw new Error('google empty')
    } catch (gErr) {
      try {
        const mUrl =
          'https://api.mymemory.translated.net/get?' +
          new URLSearchParams({ q: prepared, langpair: 'zh-CN|en' })
        const data = await fetchJson(mUrl, 12000)
        if (data?.responseStatus === 200) {
          const translated = normalizeEn(data.responseData?.translatedText)
          if (translated) {
            return { ok: true, text: translated, provider: 'mymemory' }
          }
        }
        return {
          ok: false,
          error: data?.responseDetails || 'mymemory failed',
        }
      } catch (mErr) {
        return {
          ok: false,
          error:
            (gErr instanceof Error ? gErr.message : String(gErr)) +
            ' / ' +
            (mErr instanceof Error ? mErr.message : String(mErr)),
        }
      }
    }
  })

  ipcMain.handle('open-text-file', async (_event, payload = {}) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      mainWindow || undefined,
      {
        title: payload.title || '打开文件',
        properties: ['openFile'],
        filters: Array.isArray(payload.filters) && payload.filters.length
          ? payload.filters
          : [{ name: '全部', extensions: ['*'] }],
      },
    )
    if (canceled || !filePaths?.length) return { ok: false, cancelled: true }
    const filePath = filePaths[0]
    const content = fs.readFileSync(filePath, 'utf8')
    return { ok: true, path: filePath, content }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

process.on('uncaughtException', (err) => {
  try {
    appendAppLog('uncaughtException', {
      message: err?.message,
      stack: err?.stack,
    })
  } catch {
    /* ignore */
  }
})

process.on('unhandledRejection', (reason) => {
  try {
    appendAppLog('unhandledRejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  } catch {
    /* ignore */
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

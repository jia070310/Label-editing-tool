const { app, BrowserWindow, ipcMain, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { spawn } = require('child_process')

const isDev = !app.isPackaged
const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:5173'

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {BrowserWindow | null} */
let splashWindow = null

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
    title: '标签编辑打印工具',
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

  # 用 Hashtable 记录渲染状态；$script:printed 在 PrintPage 回调里可能无法回写
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
    # 部分热敏驱动不会同步触发 PrintPage，但作业仍可能已成功入队
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
`

function normalizePrintError(raw) {
  const text = String(raw || '').trim()
  if (!text) return '打印失败'
  if (/Print page was not rendered/i.test(text)) {
    return '打印任务已发送，但驱动未返回渲染确认'
  }
  const line =
    text
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
      .pop() || text
  return line.replace(/^.*?:\s*/, '').slice(0, 240)
}

function runPowershellPrint(imagePath, printerName, widthMm, heightMm) {
  const tmpDir = path.join(os.tmpdir(), 'label-print-editor')
  fs.mkdirSync(tmpDir, { recursive: true })
  // 写到纯 ASCII 临时路径，避免中文项目路径导致 PS 解析失败
  const scriptPath = path.join(tmpDir, 'print-label-run.ps1')
  fs.writeFileSync(scriptPath, PRINT_PS1, 'ascii')

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
      ],
      { windowsHide: true },
    )

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      try {
        fs.unlinkSync(scriptPath)
      } catch {
        /* ignore */
      }
      if (code === 0) resolve({ ok: true, stdout })
      else {
        const msg = normalizePrintError(stderr || stdout)
        reject(new Error(msg || `print failed code=${code}`))
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
    deviceName = '',
    silent = false,
  } = payload

  const pageW = Number(widthMm)
  const pageH = Number(heightMm)
  const printDpi = Number(dpi) || 203

  if (!dataUrl || !(pageW > 0) || !(pageH > 0)) {
    throw new Error('打印参数无效')
  }

  const tmpDir = path.join(os.tmpdir(), 'label-print-editor')
  fs.mkdirSync(tmpDir, { recursive: true })
  const tmpPng = path.join(tmpDir, `label-${Date.now()}.png`)
  dataUrlToPngFile(dataUrl, tmpPng)

  try {
    if (process.platform === 'win32') {
      let printer = deviceName
      if (!printer && mainWindow) {
        try {
          const list = await mainWindow.webContents.getPrintersAsync()
          const def = list.find((p) => p.isDefault) || list[0]
          printer = def?.name || ''
        } catch {
          printer = ''
        }
      }
      if (!printer) {
        throw new Error('未找到打印机，请在打印对话框中选择 POSLABEL')
      }

      await runPowershellPrint(tmpPng, printer, pageW, pageH)
      return { ok: true, cancelled: false, method: 'gdi-fullbleed' }
    }

    // 非 Windows：Electron 打印整页图像
    return await printViaElectronFallback({
      dataUrl,
      pageW,
      pageH,
      printDpi,
      deviceName,
      silent,
    })
  } finally {
    setTimeout(() => {
      try {
        fs.unlinkSync(tmpPng)
      } catch {
        /* ignore */
      }
    }, 20000)
  }
}

async function printViaElectronFallback({
  dataUrl,
  pageW,
  pageH,
  printDpi,
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

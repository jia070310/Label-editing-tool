import html2canvas from 'html2canvas'
import type { LabelSettings } from '../types'
import { DESIGN_DPI, mmToPx, ptToPx } from './dpi'
import { getPrintPageSize, isElectronApp } from './electron'

/** 常见热敏标签机分辨率 */
export const DEFAULT_PRINT_DPI = DESIGN_DPI

function convertFontSizeForDpi(fontSize: string, captureDpi: number): string {
  if (fontSize.endsWith('pt')) {
    return `${Math.round(ptToPx(parseFloat(fontSize), captureDpi) * 100) / 100}px`
  }
  if (fontSize.endsWith('px')) {
    const px = parseFloat(fontSize)
    if (!Number.isFinite(px)) return fontSize
    const scaled = px * (captureDpi / DESIGN_DPI)
    return `${Math.round(scaled * 100) / 100}px`
  }
  return fontSize
}

function applyCaptureDpiStyles(root: HTMLElement, captureDpi: number) {
  const scale = captureDpi / 25.4
  root.querySelectorAll<HTMLElement>('.element').forEach((el) => {
    const toPx = (v: string, fallback: number) => {
      if (v.endsWith('mm')) return Math.round(parseFloat(v) * scale)
      if (v.endsWith('px')) {
        const px = parseFloat(v)
        return Math.round(px * (captureDpi / DESIGN_DPI))
      }
      return Math.round(fallback * scale)
    }
    el.style.left = `${toPx(el.style.left, parseFloat(el.style.left) || 0)}px`
    el.style.top = `${toPx(el.style.top, parseFloat(el.style.top) || 0)}px`
    el.style.width = `${toPx(el.style.width, parseFloat(el.style.width) || 0)}px`
    el.style.height = `${toPx(el.style.height, parseFloat(el.style.height) || 0)}px`
  })

  root.querySelectorAll('col').forEach((col) => {
    const wStyle = (col as HTMLElement).style.width
    if (wStyle.endsWith('mm')) {
      ;(col as HTMLElement).style.width =
        `${Math.round(parseFloat(wStyle) * scale)}px`
    } else if (wStyle.endsWith('px')) {
      ;(col as HTMLElement).style.width = `${Math.round(parseFloat(wStyle) * (captureDpi / DESIGN_DPI))}px`
    }
  })
  root.querySelectorAll('tr').forEach((tr) => {
    const hStyle = (tr as HTMLElement).style.height
    if (hStyle.endsWith('mm')) {
      ;(tr as HTMLElement).style.height =
        `${Math.round(parseFloat(hStyle) * scale)}px`
    } else if (hStyle.endsWith('px')) {
      ;(tr as HTMLElement).style.height = `${Math.round(parseFloat(hStyle) * (captureDpi / DESIGN_DPI))}px`
    }
  })
  root.querySelectorAll('td').forEach((td) => {
    const cell = td as HTMLElement
    ;(['borderTop', 'borderLeft', 'borderRight', 'borderBottom'] as const).forEach(
      (prop) => {
        const val = cell.style[prop]
        if (val?.includes('mm')) {
          cell.style[prop] = val.replace(
            /([\d.]+)mm/g,
            (_, n: string) =>
              `${Math.max(1, Math.round(parseFloat(n) * scale))}px`,
          )
        } else if (val?.includes('px')) {
          cell.style[prop] = val.replace(
            /([\d.]+)px/g,
            (_, n: string) =>
              `${Math.max(1, Math.round(parseFloat(n) * (captureDpi / DESIGN_DPI)))}px`,
          )
        }
      },
    )
  })

  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.style.fontSize) {
      el.style.fontSize = convertFontSizeForDpi(el.style.fontSize, captureDpi)
    }
    if (el.style.letterSpacing?.endsWith('px')) {
      const px = parseFloat(el.style.letterSpacing)
      if (Number.isFinite(px)) {
        el.style.letterSpacing = `${Math.round(px * (captureDpi / DESIGN_DPI) * 100) / 100}px`
      }
    }
    if (el.style.borderWidth?.endsWith('px')) {
      const px = parseFloat(el.style.borderWidth)
      if (Number.isFinite(px)) {
        el.style.borderWidth = `${Math.round(px * (captureDpi / DESIGN_DPI) * 100) / 100}px`
      }
    }
  })
}

function stripPrintChrome(root: HTMLElement) {
  root
    .querySelectorAll('.element-frame, .handle, .blank-canvas-hint')
    .forEach((n) => n.remove())
  root.querySelectorAll('.selected, .selected-cell, .editing').forEach((n) => {
    n.classList.remove('selected', 'selected-cell', 'editing')
  })
}

/**
 * 按打印机 DPI 栅格化整张标签（例如 100mm@203dpi ≈ 799px）
 * 保证 1:1 物理尺寸，避免再被「适应页面」缩放。
 */
export async function captureLabelImage(
  sheet: HTMLElement,
  settings: LabelSettings,
  dpi = DEFAULT_PRINT_DPI,
): Promise<string> {
  const w = settings.width
  const h = settings.height
  const pxW = Math.round(mmToPx(w, dpi))
  const pxH = Math.round(mmToPx(h, dpi))

  const host = document.createElement('div')
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${pxW}px`,
    `height:${pxH}px`,
    'background:#fff',
    'overflow:hidden',
    'z-index:-1',
  ].join(';')

  const clone = sheet.cloneNode(true) as HTMLElement
  stripPrintChrome(clone)

  // 用像素固定画布，与目标 DPI 一一对应（不再依赖屏幕 mm→px）
  clone.style.cssText = [
    'position:relative',
    `width:${pxW}px`,
    `height:${pxH}px`,
    'margin:0',
    'padding:0',
    'box-shadow:none',
    'outline:none',
    'border:none',
    'background:#fff',
    'overflow:hidden',
    'transform:none',
    settings.shape === 'circle'
      ? 'border-radius:50%'
      : settings.shape === 'round-rect'
        ? `border-radius:${Math.round(mmToPx(3, dpi))}px`
        : '',
  ]
    .filter(Boolean)
    .join(';')

  applyCaptureDpiStyles(clone, dpi)

  host.appendChild(clone)
  document.body.appendChild(host)

  try {
    const canvas = await html2canvas(host, {
      backgroundColor: '#ffffff',
      scale: 1,
      width: pxW,
      height: pxH,
      useCORS: true,
      logging: false,
      windowWidth: pxW,
      windowHeight: pxH,
    })

    // 强制输出为目标像素尺寸（防止 html2canvas 偏差）
    let out = canvas
    if (canvas.width !== pxW || canvas.height !== pxH) {
      const fixed = document.createElement('canvas')
      fixed.width = pxW
      fixed.height = pxH
      const ctx = fixed.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, pxW, pxH)
        ctx.drawImage(canvas, 0, 0, pxW, pxH)
        out = fixed
      }
    }

    if (settings.orientation !== 0) {
      out = rotateCanvas(out, settings.orientation)
    }
    return out.toDataURL('image/png')
  } finally {
    host.remove()
  }
}

function rotateCanvas(source: HTMLCanvasElement, deg: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return source

  const rad = (deg * Math.PI) / 180
  const swap = deg === 90 || deg === 270
  canvas.width = swap ? source.height : source.width
  canvas.height = swap ? source.width : source.height

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(source, -source.width / 2, -source.height / 2)
  return canvas
}

export interface PrintOptions {
  dpi?: number
  deviceName?: string
  silent?: boolean
}

async function printViaElectron(
  dataUrl: string,
  settings: LabelSettings,
  options: PrintOptions = {},
): Promise<void> {
  const { widthMm, heightMm } = getPrintPageSize(settings)
  const result = await window.electronAPI!.printLabel({
    dataUrl,
    widthMm,
    heightMm,
    dpi: options.dpi ?? DEFAULT_PRINT_DPI,
    deviceName: options.deviceName ?? '',
    silent: options.silent ?? false,
  })
  if (result?.cancelled) return
}

function printViaBrowserIframe(
  dataUrl: string,
  settings: LabelSettings,
): Promise<void> {
  const { widthMm: pageW, heightMm: pageH } = getPrintPageSize(settings)

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    iframe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;border:0;opacity:0;pointer-events:none'
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    const doc = iframe.contentDocument
    if (!win || !doc) {
      iframe.remove()
      reject(new Error('无法创建打印帧'))
      return
    }

    let done = false
    const cleanup = () => {
      if (done) return
      done = true
      setTimeout(() => iframe.remove(), 400)
      resolve()
    }

    win.onafterprint = cleanup

    doc.open()
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title></title>
<style>
@page{size:${pageW}mm ${pageH}mm;margin:0}
html,body{margin:0;padding:0;width:${pageW}mm;height:${pageH}mm;overflow:hidden;background:#fff}
img{display:block;width:${pageW}mm;height:${pageH}mm;object-fit:fill}
</style></head><body><img id="label" src="${dataUrl}" /></body></html>`)
    doc.close()

    const img = doc.getElementById('label') as HTMLImageElement | null
    const trigger = () => {
      try {
        win.focus()
        win.print()
      } catch {
        cleanup()
        reject(new Error('唤起打印失败'))
        return
      }
      setTimeout(cleanup, 5000)
    }

    if (!img) {
      cleanup()
      reject(new Error('打印内容加载失败'))
      return
    }
    if (img.complete && img.naturalWidth > 0) setTimeout(trigger, 100)
    else {
      img.onload = () => setTimeout(trigger, 80)
      img.onerror = () => {
        cleanup()
        reject(new Error('标签图像加载失败'))
      }
      setTimeout(trigger, 1500)
    }
  })
}

export async function printLabelImage(
  dataUrl: string,
  settings: LabelSettings,
  options: PrintOptions = {},
): Promise<void> {
  if (isElectronApp()) {
    await printViaElectron(dataUrl, settings, options)
    return
  }
  await printViaBrowserIframe(dataUrl, settings)
}

export async function printLabelSheet(
  sheet: HTMLElement,
  settings: LabelSettings,
  options: PrintOptions = {},
): Promise<string> {
  const dataUrl = await captureLabelImage(
    sheet,
    settings,
    options.dpi ?? DEFAULT_PRINT_DPI,
  )
  await printLabelImage(dataUrl, settings, options)
  return dataUrl
}

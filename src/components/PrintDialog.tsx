import { useEffect, useState } from 'react'
import { Loader2, Printer, X } from 'lucide-react'
import type { LabelSettings } from '../types'
import {
  captureLabelImage,
  DEFAULT_PRINT_DPI,
  printLabelImage,
} from '../utils/print'
import { isElectronApp } from '../utils/electron'

interface Props {
  open: boolean
  sheet: HTMLElement | null
  settings: LabelSettings
  onClose: () => void
}

interface PrinterInfo {
  name: string
  displayName?: string
  isDefault?: boolean
}

export function PrintDialog({ open, sheet, settings, onClose }: Props) {
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [error, setError] = useState('')
  const [dpi, setDpi] = useState(DEFAULT_PRINT_DPI)
  const [printers, setPrinters] = useState<PrinterInfo[]>([])
  const [deviceName, setDeviceName] = useState('')
  const desktop = isElectronApp()

  const pxW = Math.round((settings.width / 25.4) * dpi)
  const pxH = Math.round((settings.height / 25.4) * dpi)

  useEffect(() => {
    if (!open || !desktop) return
    window.electronAPI
      ?.getPrinters()
      .then((list) => {
        const arr = (list || []) as PrinterInfo[]
        setPrinters(arr)
        const def = arr.find((p) => p.isDefault) || arr[0]
        if (def) setDeviceName(def.name)
      })
      .catch(() => setPrinters([]))
  }, [open, desktop])

  useEffect(() => {
    if (!open || !sheet) return
    let cancelled = false
    setLoading(true)
    setError('')
    setPreview(null)

    captureLabelImage(sheet, settings, dpi)
      .then((url) => {
        if (!cancelled) setPreview(url)
      })
      .catch(() => {
        if (!cancelled) setError('生成打印预览失败，请重试')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, sheet, settings, dpi])

  if (!open) return null

  const doPrint = async () => {
    if (!preview || printing) return
    setPrinting(true)
    setError('')
    try {
      await printLabelImage(preview, settings, {
        dpi,
        deviceName: deviceName || undefined,
        silent: false,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : '唤起打印失败，请重试'
      setError(msg)
      void import('../utils/feedback').then(({ reportClientError }) =>
        reportClientError(e, { kind: 'print-dialog', deviceName, dpi }),
      )
    } finally {
      setPrinting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card print-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>
            打印预览 · {settings.width}×{settings.height} mm
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body print-dialog-body">
          <div className="print-preview-wrap">
            {loading && (
              <div className="print-preview-loading">
                <Loader2 size={28} className="spin" />
                <span>正在按 {dpi} DPI 生成 {pxW}×{pxH} 像素图像…</span>
              </div>
            )}
            {!loading && preview && (
              <img
                src={preview}
                alt="打印预览"
                className="print-preview-img"
                style={{
                  aspectRatio: `${settings.width} / ${settings.height}`,
                }}
              />
            )}
            {!loading && !preview && !error && (
              <span className="print-preview-loading">暂无预览</span>
            )}
          </div>

          <div className="print-options">
            <div className="print-option-row">
              <label>打印机 DPI</label>
              <select
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value))}
              >
                <option value={203}>203（常见热敏）</option>
                <option value={300}>300</option>
                <option value={600}>600</option>
              </select>
            </div>
            {desktop && printers.length > 0 && (
              <div className="print-option-row">
                <label>打印机</label>
                <select
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                >
                  {printers.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.displayName || p.name}
                      {p.isDefault ? '（默认）' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <p className="print-note">
            将按 <strong>{settings.width}×{settings.height} mm</strong> 满铺打印到所选打印机
            （图像 {pxW}×{pxH} px @ {dpi} DPI）。
            {dpi === DEFAULT_PRINT_DPI
              ? ' 编辑界面与 203 DPI 预览一致。'
              : ' 非 203 DPI 时字号会按比例缩放。'}
            {desktop
              ? ' Windows 使用物理尺寸直打，不再「适应页面」。'
              : ' 请使用桌面版打印（npm run desktop）。'}
            {' '}
            若打印后多走一张空白，请在 Windows 打印机属性里把纸张尺寸设为与标签一致，并关闭「打印后走纸」类选项。
          </p>
          {error && (
            <div className="form-error print-error-block">
              <p>{error}</p>
              {desktop && (
                <button
                  type="button"
                  className="btn-secondary print-log-btn"
                  onClick={() => window.electronAPI?.exportFeedbackLog?.()}
                >
                  导出反馈日志
                </button>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer print-dialog-footer">
          <button className="btn-secondary" onClick={onClose} disabled={printing}>
            取消
          </button>
          <button
            className="btn-create"
            disabled={!preview || loading || printing}
            onClick={doPrint}
          >
            {printing ? (
              <>
                <Loader2 size={16} className="spin" />
                正在打印…
              </>
            ) : (
              <>
                <Printer size={16} />
                打印
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

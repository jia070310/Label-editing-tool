import { useState } from 'react'
import { X } from 'lucide-react'
import type { LabelSettings, LabelShape, PrintOrientation, PrintRows } from '../types'
import { defaultLabelSettings } from '../types'

interface Props {
  open: boolean
  defaultName: string
  initial?: Partial<LabelSettings>
  title?: string
  confirmText?: string
  onClose: () => void
  onConfirm: (settings: LabelSettings) => void
}

export function NewLabelDialog({
  open,
  defaultName,
  initial,
  title = '新建标签',
  confirmText = '新建',
  onClose,
  onConfirm,
}: Props) {
  const [name, setName] = useState(initial?.name ?? defaultName)
  const [shape, setShape] = useState<LabelShape>(initial?.shape ?? 'rect')
  const [width, setWidth] = useState(String(initial?.width ?? 40))
  const [height, setHeight] = useState(String(initial?.height ?? 30))
  const [orientation, setOrientation] = useState<PrintOrientation>(
    initial?.orientation ?? 0,
  )
  const [printRows, setPrintRows] = useState<PrintRows>(initial?.printRows ?? 1)
  const [error, setError] = useState('')

  if (!open) return null

  const submit = () => {
    const w = Number(width)
    const h = Number(height)
    if (!name.trim()) {
      setError('请填写标签名称')
      return
    }
    if (!Number.isFinite(w) || w < 1 || w > 300) {
      setError('宽度需在 1～300 mm')
      return
    }
    if (!Number.isFinite(h) || h < 1 || h > 400) {
      setError('高度需在 1～400 mm')
      return
    }
    onConfirm(
      defaultLabelSettings({
        name: name.trim(),
        shape,
        width: Math.round(w * 100) / 100,
        height: Math.round(h * 100) / 100,
        orientation,
        printRows,
      }),
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-row">
            <label>
              标签名称 <span className="req">*</span>
            </label>
            <input
              type="text"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>标签形状</label>
            <select
              value={shape}
              onChange={(e) => setShape(e.target.value as LabelShape)}
            >
              <option value="rect">矩形</option>
              <option value="round-rect">圆角矩形</option>
              <option value="circle">圆形</option>
            </select>
          </div>

          <div className="form-row">
            <label>
              宽度 <span className="req">*</span>
            </label>
            <div className="form-inline">
              <input
                type="number"
                min={1}
                max={300}
                step={0.1}
                value={width}
                onChange={(e) => setWidth(e.target.value)}
              />
              <span className="unit">mm</span>
              <span className="hint-inline">(范围1～300)</span>
            </div>
          </div>

          <div className="form-row">
            <label>
              高度 <span className="req">*</span>
            </label>
            <div className="form-inline">
              <input
                type="number"
                min={1}
                max={400}
                step={0.1}
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
              <span className="unit">mm</span>
              <span className="hint-inline">(范围1～400)</span>
            </div>
          </div>

          <p className="paper-note">
            纸张类型 支持间隙纸、连续纸、黑标纸，以驱动为准，请前往驱动设置
          </p>

          <div className="form-row form-row-top">
            <label>出纸方向</label>
            <div className="orient-group">
              {([0, 90, 180, 270] as PrintOrientation[]).map((deg) => (
                <label key={deg} className="radio-item">
                  <input
                    type="radio"
                    name="orient"
                    checked={orientation === deg}
                    onChange={() => setOrientation(deg)}
                  />
                  <span>{deg}°</span>
                </label>
              ))}
              <div className="orient-preview" aria-hidden>
                <div className="printer-icon" />
                <div
                  className="paper-out"
                  style={{ transform: `rotate(${orientation}deg)` }}
                />
              </div>
            </div>
          </div>

          <div className="form-divider" />

          <div className="form-row">
            <label>打印排数</label>
            <select
              value={printRows}
              onChange={(e) => setPrintRows(Number(e.target.value) as PrintRows)}
            >
              <option value={1}>单排 (一行一个标签)</option>
              <option value={2}>双排 (一行两个标签)</option>
              <option value={3}>三排 (一行三个标签)</option>
              <option value={4}>四排 (一行四个标签)</option>
            </select>
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer">
          <button className="btn-create" onClick={submit}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

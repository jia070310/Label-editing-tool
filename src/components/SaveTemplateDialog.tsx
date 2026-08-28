import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

export type SaveTemplateMode = 'overwrite' | 'new'

interface Props {
  open: boolean
  currentName: string
  canOverwrite: boolean
  originalName?: string
  onClose: () => void
  onConfirm: (mode: SaveTemplateMode, name: string) => void
}

export function SaveTemplateDialog({
  open,
  currentName,
  canOverwrite,
  originalName,
  onClose,
  onConfirm,
}: Props) {
  const [mode, setMode] = useState<SaveTemplateMode>(
    canOverwrite ? 'overwrite' : 'new',
  )
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setMode(canOverwrite ? 'overwrite' : 'new')
    setName(`${currentName.trim() || '新建标签'} 副本`)
    setError('')
  }, [open, canOverwrite, currentName])

  if (!open) return null

  const submit = () => {
    if (mode === 'overwrite') {
      if (!canOverwrite) {
        setError('当前模板尚未保存，请选择另存为新模板')
        return
      }
      onConfirm('overwrite', currentName.trim() || originalName || '未命名模板')
      return
    }
    const next = name.trim()
    if (!next) {
      setError('请填写新模板名称')
      return
    }
    onConfirm('new', next)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card modal-card-sm save-template-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>保存模板</h2>
          <button className="modal-close" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p className="save-template-hint">
            编辑内容仅在点击保存后才会写入模板库；未保存的修改不会影响原模板。
          </p>

          <div className="save-template-options">
            <label
              className={`save-template-option ${!canOverwrite ? 'disabled' : ''}`}
            >
              <input
                type="radio"
                name="save-mode"
                checked={mode === 'overwrite'}
                disabled={!canOverwrite}
                onChange={() => setMode('overwrite')}
              />
              <span>
                覆盖原模板
                {originalName ? `「${originalName}」` : ''}
              </span>
            </label>

            <label className="save-template-option">
              <input
                type="radio"
                name="save-mode"
                checked={mode === 'new'}
                onChange={() => setMode('new')}
              />
              <span>另存为新模板</span>
            </label>
          </div>

          {mode === 'new' && (
            <div className="form-row">
              <label>新模板名称</label>
              <input
                type="text"
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          )}

          {error && <p className="form-error">{error}</p>}
        </div>

        <div className="modal-footer split">
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn-create" onClick={submit}>
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

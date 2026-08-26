import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FilePlus2, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import type { LabelTemplate } from '../utils/storage'

interface Props {
  templates: LabelTemplate[]
  onNew: () => void
  onOpen: (tpl: LabelTemplate) => void
  onDelete: (id: string) => void
  onRename: (id: string, name: string) => void
}

type ContextMenuState = {
  x: number
  y: number
  tpl: LabelTemplate
}

function formatTime(ts: number) {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function HomeScreen({
  templates,
  onNew,
  onOpen,
  onDelete,
  onRename,
}: Props) {
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  const [renaming, setRenaming] = useState<LabelTemplate | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  useEffect(() => {
    if (!renaming) return
    // 等右键菜单的 click/mousedown 周期结束后再聚焦，否则在 Electron/Chromium
    // 下会出现「有焦点框但无光标、无法输入」的情况
    const timer = window.setTimeout(() => {
      const el = renameInputRef.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.select()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [renaming])

  const openRename = (tpl: LabelTemplate) => {
    setMenu(null)
    setRenameError('')
    setRenameValue(tpl.settings.name ?? '')
    // 延后打开，避免菜单卸载抢焦点
    window.setTimeout(() => setRenaming(tpl), 0)
  }

  const submitRename = () => {
    if (!renaming) return
    const name = renameValue.trim()
    if (!name) {
      setRenameError('请输入模板名称')
      return
    }
    if (
      templates.some(
        (t) => t.id !== renaming.id && t.settings.name === name,
      )
    ) {
      setRenameError('该名称已存在，请换一个')
      return
    }
    onRename(renaming.id, name)
    setRenaming(null)
    setRenameValue('')
    setRenameError('')
  }

  const handleDelete = (tpl: LabelTemplate) => {
    setMenu(null)
    if (confirm(`确定删除「${tpl.settings.name}」？`)) {
      onDelete(tpl.id)
    }
  }

  return (
    <div className="home-screen">
      <div className="home-hero">
        <h1>标签编辑打印</h1>
        <p>桌面版精确毫米打印 · 先选择模板，或按纸张尺寸新建空白标签</p>
        <div className="home-actions">
          <button className="home-btn primary" onClick={onNew}>
            <FilePlus2 size={18} />
            新建标签模板
          </button>
        </div>
      </div>

      <div className="home-list-wrap">
        <div className="home-list-head">
          <FolderOpen size={16} />
          <span>我的模板</span>
          <em>{templates.length}</em>
        </div>

        {templates.length === 0 ? (
          <div className="home-empty">
            暂无已保存模板，点击上方「新建标签模板」开始
          </div>
        ) : (
          <ul className="home-list">
            {templates.map((tpl) => (
              <li
                key={tpl.id}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenu({ x: e.clientX, y: e.clientY, tpl })
                }}
              >
                <button className="tpl-card" onClick={() => onOpen(tpl)}>
                  <div
                    className="tpl-thumb"
                    style={{
                      aspectRatio: `${tpl.settings.width} / ${tpl.settings.height}`,
                    }}
                  >
                    <span>
                      {tpl.settings.width} × {tpl.settings.height} mm
                    </span>
                  </div>
                  <div className="tpl-meta">
                    <strong>{tpl.settings.name}</strong>
                    <span>{formatTime(tpl.updatedAt)}</span>
                    <span>
                      {tpl.elements.length} 个元素 ·{' '}
                      {tpl.settings.orientation}°
                    </span>
                  </div>
                </button>
                <button
                  className="tpl-delete"
                  title="删除模板"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(tpl)
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {menu && (
        <div
          className="tpl-context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              onOpen(menu.tpl)
              setMenu(null)
            }}
          >
            打开
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={() => openRename(menu.tpl)}
          >
            <Pencil size={14} />
            重命名
          </button>
          <button
            type="button"
            className="danger"
            onClick={() => handleDelete(menu.tpl)}
          >
            <Trash2 size={14} />
            删除
          </button>
        </div>
      )}

      {renaming &&
        createPortal(
          <div
            className="modal-backdrop rename-modal-backdrop"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setRenaming(null)
                setRenameError('')
              }
            }}
          >
            <div
              className="modal-card modal-card-sm"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rename-template-title"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 id="rename-template-title">重命名模板</h2>
              </div>
              <div className="modal-body">
                <div className="form-row">
                  <label htmlFor="rename-template-input">
                    模板名称 <span className="req">*</span>
                  </label>
                  <input
                    id="rename-template-input"
                    ref={renameInputRef}
                    type="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={40}
                    value={renameValue}
                    onChange={(e) => {
                      setRenameValue(e.target.value)
                      setRenameError('')
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        submitRename()
                      }
                      if (e.key === 'Escape') {
                        e.preventDefault()
                        setRenaming(null)
                        setRenameError('')
                      }
                    }}
                  />
                </div>
                {renameError && <p className="form-error">{renameError}</p>}
              </div>
              <div className="modal-footer split">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setRenaming(null)
                    setRenameError('')
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn-create"
                  onClick={submitRename}
                >
                  确定
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

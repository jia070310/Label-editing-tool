import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Braces } from 'lucide-react'
import { PRESET_VARIABLES } from '../utils/variables'

interface Props {
  disabled?: boolean
  onInsert: (name: string) => void
}

export function VariableInsertButton({ disabled, onInsert }: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [customName, setCustomName] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const place = () => {
      const r = btnRef.current!.getBoundingClientRect()
      const menuW = 200
      const menuH = 380
      let left = r.left
      let top = r.bottom + 4
      if (left + menuW > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - menuW - 8)
      }
      if (top + menuH > window.innerHeight - 8) {
        top = Math.max(8, r.top - menuH - 4)
      }
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setCustomName('')
      return
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const submitCustom = () => {
    const name = customName.trim().replace(/[{}]/g, '')
    if (!name) {
      customInputRef.current?.focus()
      return
    }
    onInsert(name)
    setCustomName('')
    setOpen(false)
  }

  return (
    <div className="variable-insert">
      <button
        ref={btnRef}
        type="button"
        className={`tool-btn ${open ? 'active' : ''}`}
        disabled={disabled}
        title="插入变量：可用于文本、表格、条码/二维码；批量打印时替换"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
      >
        <Braces size={15} />
        <span className="label">变量</span>
      </button>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={menuRef}
            className="variable-insert-menu"
            style={{ top: pos.top, left: pos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="variable-insert-title">插入变量</div>
            <p className="variable-insert-hint">文本 / 表格 / 条码均可使用</p>
            {PRESET_VARIABLES.map((name) => (
              <button
                key={name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onInsert(name)
                  setOpen(false)
                }}
              >
                <code>{`{{${name}}}`}</code>
                <span>{name}</span>
              </button>
            ))}

            <div className="variable-insert-divider" />
            <div className="variable-insert-title">自定义</div>
            <div className="variable-insert-custom">
              <span className="variable-insert-brace">{'{{'}</span>
              <input
                ref={customInputRef}
                type="text"
                value={customName}
                placeholder="字段名"
                maxLength={32}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    submitCustom()
                  }
                  e.stopPropagation()
                }}
              />
              <span className="variable-insert-brace">{'}}'}</span>
              <button
                type="button"
                className="primary"
                onMouseDown={(e) => e.preventDefault()}
                onClick={submitCustom}
              >
                插入
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MAX_TABLE_COLS, MAX_TABLE_ROWS } from '../utils/table'

export type InsertRowWhere = 'above' | 'below'
export type InsertColWhere = 'left' | 'right'
/** @deprecated use InsertRowWhere */
export type InsertWhere = InsertRowWhere

type MenuMode =
  | 'insert-row'
  | 'insert-col'
  | 'delete-row'
  | 'delete-col'
  | null

interface MenuState {
  x: number
  y: number
  row: number
  col: number
}

interface Props {
  open: MenuState | null
  currentRows: number
  currentCols: number
  onClose: () => void
  onInsertRows: (row: number, count: number, where: InsertRowWhere) => void
  onInsertCols: (col: number, count: number, where: InsertColWhere) => void
  onDeleteRows: (row: number, count: number) => void
  onDeleteCols: (col: number, count: number) => void
}

export function TableRowContextMenu({
  open,
  currentRows,
  currentCols,
  onClose,
  onInsertRows,
  onInsertCols,
  onDeleteRows,
  onDeleteCols,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<MenuMode>(null)
  const [count, setCount] = useState('1')
  const [rowWhere, setRowWhere] = useState<InsertRowWhere>('below')
  const [colWhere, setColWhere] = useState<InsertColWhere>('right')

  useEffect(() => {
    if (!open) {
      setMode(null)
      setCount('1')
      setRowWhere('below')
      setColWhere('right')
      return
    }
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (mode) setMode(null)
        else onClose()
      }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, mode])

  if (!open) return null

  const insertRowRoom = Math.max(0, MAX_TABLE_ROWS - currentRows)
  const insertColRoom = Math.max(0, MAX_TABLE_COLS - currentCols)
  const deleteRowMax = Math.max(0, currentRows - 1)
  const deleteColMax = Math.max(0, currentCols - 1)
  const canInsertRow = insertRowRoom > 0
  const canInsertCol = insertColRoom > 0
  const canDeleteRow = deleteRowMax > 0
  const canDeleteCol = deleteColMax > 0

  const left = Math.min(open.x, window.innerWidth - 260)
  const top = Math.min(open.y, window.innerHeight - 320)

  const startMode = (next: MenuMode) => {
    setMode(next)
    setCount('1')
    setRowWhere('below')
    setColWhere('right')
  }

  const submit = () => {
    const n = Math.floor(Number(count))
    if (!Number.isFinite(n) || n < 1) return
    if (mode === 'insert-row') {
      if (!canInsertRow) return
      onInsertRows(open.row, Math.min(n, insertRowRoom), rowWhere)
      onClose()
      return
    }
    if (mode === 'insert-col') {
      if (!canInsertCol) return
      onInsertCols(open.col, Math.min(n, insertColRoom), colWhere)
      onClose()
      return
    }
    if (mode === 'delete-row') {
      if (!canDeleteRow) return
      onDeleteRows(open.row, Math.min(n, deleteRowMax, currentRows - open.row))
      onClose()
      return
    }
    if (mode === 'delete-col') {
      if (!canDeleteCol) return
      onDeleteCols(open.col, Math.min(n, deleteColMax, currentCols - open.col))
      onClose()
    }
  }

  const panelTitle =
    mode === 'insert-row'
      ? '插入行'
      : mode === 'insert-col'
        ? '插入列'
        : mode === 'delete-row'
          ? '删除行'
          : mode === 'delete-col'
            ? '删除列'
            : ''

  const isInsert = mode === 'insert-row' || mode === 'insert-col'
  const isRow = mode === 'insert-row' || mode === 'delete-row'
  const maxCount =
    mode === 'insert-row'
      ? insertRowRoom || 1
      : mode === 'insert-col'
        ? insertColRoom || 1
        : mode === 'delete-row'
          ? Math.min(deleteRowMax, currentRows - open.row) || 1
          : Math.min(deleteColMax, currentCols - open.col) || 1
  const submitDisabled =
    mode === 'insert-row'
      ? !canInsertRow
      : mode === 'insert-col'
        ? !canInsertCol
        : mode === 'delete-row'
          ? !canDeleteRow
          : !canDeleteCol

  return createPortal(
    <div
      ref={ref}
      className="table-context-menu"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {mode === null ? (
        <>
          <button
            type="button"
            disabled={!canInsertRow}
            onClick={() => startMode('insert-row')}
          >
            插入行…
          </button>
          <button
            type="button"
            disabled={!canInsertCol}
            onClick={() => startMode('insert-col')}
          >
            插入列…
          </button>
          <div className="table-context-divider" />
          <button
            type="button"
            className="danger"
            disabled={!canDeleteRow}
            onClick={() => startMode('delete-row')}
          >
            删除行…
          </button>
          <button
            type="button"
            className="danger"
            disabled={!canDeleteCol}
            onClick={() => startMode('delete-col')}
          >
            删除列…
          </button>
          {!canDeleteRow && !canDeleteCol && (
            <p className="table-context-hint">至少保留 1 行 1 列</p>
          )}
        </>
      ) : (
        <div className="table-context-panel">
          <div className="table-context-group-label">{panelTitle}</div>

          {isInsert && (
            <div className="table-context-field">
              <span>方向</span>
              <div className="table-context-seg">
                {isRow ? (
                  <>
                    <button
                      type="button"
                      className={rowWhere === 'above' ? 'active' : ''}
                      onClick={() => setRowWhere('above')}
                    >
                      向上
                    </button>
                    <button
                      type="button"
                      className={rowWhere === 'below' ? 'active' : ''}
                      onClick={() => setRowWhere('below')}
                    >
                      向下
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={colWhere === 'left' ? 'active' : ''}
                      onClick={() => setColWhere('left')}
                    >
                      向左
                    </button>
                    <button
                      type="button"
                      className={colWhere === 'right' ? 'active' : ''}
                      onClick={() => setColWhere('right')}
                    >
                      向右
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!isInsert && (
            <p className="table-context-hint soft">
              {isRow
                ? '从当前行起向下删除'
                : '从当前列起向右删除'}
            </p>
          )}

          <div className="table-context-field">
            <span>数量</span>
            <input
              type="number"
              min={1}
              max={maxCount}
              value={count}
              autoFocus
              onChange={(e) => setCount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <span>{isRow ? '行' : '列'}</span>
          </div>

          <div className="table-context-actions">
            <button type="button" onClick={() => setMode(null)}>
              返回
            </button>
            <button
              type="button"
              className={isInsert ? 'primary' : 'primary danger'}
              disabled={submitDisabled}
              onClick={submit}
            >
              确定
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

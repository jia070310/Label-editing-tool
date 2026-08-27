import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuid } from 'uuid'
import { TopToolbar } from './components/TopToolbar'
import { LeftToolbox } from './components/LeftToolbox'
import { RightPanel } from './components/RightPanel'
import { ElementView } from './components/ElementView'
import { HomeScreen } from './components/HomeScreen'
import { NewLabelDialog } from './components/NewLabelDialog'
import { useHistory } from './hooks/useHistory'
import type {
  CellPos,
  ElementType,
  LabelElement,
  LabelSettings,
  ResizeHandle,
  TableCell,
  TableElement,
} from './types'
import { defaultLabelSettings } from './types'
import { defaultFittedTableUnitSize, fitNewElementToLabel } from './utils/fitElement'
import {
  createBarcodeElement,
  createLineElement,
  createQrcodeElement,
  createRectElement,
  createTableElement,
  createTextElement,
  insertRows,
  insertCols,
  deleteRows,
  deleteCols,
  MAX_TABLE_COLS,
  MAX_TABLE_ROWS,
  mergeCells,
  resizeTableBox,
  resizeColInRows,
  resizeRowInCols,
  setColWidth,
  setRowHeight,
  setTableCols,
  setTableRows,
  moveColBoundaryInRows,
  moveRowBoundaryInCols,
  splitCell,
  updateCell,
  updateCells,
  updateAllCells,
} from './utils/table'
import {
  deleteTemplate,
  loadTemplates,
  MM_TO_PX,
  nextDefaultName,
  parseTemplateFile,
  prepareImportedTemplate,
  renameTemplate,
  type LabelTemplate,
  upsertTemplate,
} from './utils/storage'
import { exportTemplateFile, pickTemplateFileContent } from './utils/templateIo'
import { mmStyle, mmToPx } from './utils/dpi'
import { PrintDialog } from './components/PrintDialog'
import { BatchPrintDialog } from './components/BatchPrintDialog'
import {
  getSelectedText,
  hasChinese,
  mergeTranslationIntoCell,
  pickSourceText,
  removeTranslationFromCell,
  cellHasTranslation,
  translateZhToEn,
} from './utils/translate'
import { variableToken } from './utils/variables'
import {
  canRotateElement,
  normalizeRotation,
  rotateElementBy90,
} from './utils/rotate'
import './index.css'

type ViewMode = 'home' | 'editor'

type DragMode =
  | {
      kind: 'move'
      id: string
      startX: number
      startY: number
      origX: number
      origY: number
      pendingX: number
      pendingY: number
    }
  | {
      kind: 'resize'
      id: string
      handle: ResizeHandle
      startX: number
      startY: number
      orig: LabelElement
      pendingX: number
      pendingY: number
      pendingW: number
      pendingH: number
    }
  | {
      kind: 'rotate'
      id: string
      centerX: number
      centerY: number
      startAngle: number
      origRotation: number
      pendingRotation: number
    }

function getElementNode(id: string): HTMLElement | null {
  return document.querySelector(
    `[data-element-id="${id}"]`,
  ) as HTMLElement | null
}

/** 拖拽过程中直接改 DOM，避免每帧 React 重渲染 */
function paintElementBox(
  id: string,
  box: {
    x?: number
    y?: number
    width?: number
    height?: number
    rotation?: number
  },
) {
  const node = getElementNode(id)
  if (!node) return
  if (box.x != null) node.style.left = mmStyle(box.x)
  if (box.y != null) node.style.top = mmStyle(box.y)
  if (box.width != null) node.style.width = mmStyle(box.width)
  if (box.height != null) node.style.height = mmStyle(box.height)
  if (box.rotation != null) {
    node.style.transform =
      box.rotation === 0 ? '' : `rotate(${box.rotation}deg)`
  }
}

function createElement(
  type: ElementType | 'image' | 'date' | 'warning',
  labelW: number,
  labelH: number,
): LabelElement | null {
  let el: LabelElement | null = null
  switch (type) {
    case 'table':
      el = createTableElement(5, 5)
      break
    case 'text':
      el = createTextElement(2, 2)
      break
    case 'rect':
      el = createRectElement(2, 2)
      break
    case 'line':
      el = createLineElement(2, 10)
      break
    case 'barcode':
      el = createBarcodeElement(2, 2)
      break
    case 'qrcode':
      el = createQrcodeElement(2, 2)
      break
    case 'date': {
      const dateEl = createTextElement(2, 2)
      dateEl.content = new Date().toLocaleDateString('zh-CN')
      dateEl.width = 28
      el = dateEl
      break
    }
    case 'warning': {
      const warnEl = createTextElement(2, 2)
      warnEl.content = '注意：请远离火源'
      warnEl.color = '#c0392b'
      warnEl.fontWeight = 'bold'
      warnEl.width = 36
      el = warnEl
      break
    }
    case 'image':
      return null
    default:
      el = createTextElement()
  }
  return el ? fitNewElementToLabel(el, labelW, labelH) : null
}

function Ruler({
  lengthMm,
  zoom,
  vertical,
}: {
  lengthMm: number
  zoom: number
  vertical?: boolean
}) {
  const ticks = []
  for (let i = 0; i <= Math.ceil(lengthMm); i++) {
    const major = i % 10 === 0
    const mid = i % 5 === 0
    const size = major ? 12 : mid ? 8 : 4
    if (vertical) {
      ticks.push(
        <div
          key={i}
          className="ruler-tick"
          style={{
            top: i * MM_TO_PX * zoom,
            width: size,
          }}
        >
          {major ? (
            <span style={{ position: 'absolute', left: 2, top: 1, fontSize: 9 }}>
              {i}
            </span>
          ) : null}
        </div>,
      )
    } else {
      ticks.push(
        <div
          key={i}
          className="ruler-tick"
          style={{
            left: i * MM_TO_PX * zoom,
            height: size,
            marginTop: 22 - size,
          }}
        >
          {major ? (
            <span style={{ position: 'absolute', left: 2, top: 1 }}>{i}</span>
          ) : null}
        </div>,
      )
    }
  }
  return (
    <div
      className={vertical ? 'ruler-v' : 'ruler-h'}
      style={
        vertical
          ? { height: lengthMm * MM_TO_PX * zoom }
          : { width: lengthMm * MM_TO_PX * zoom }
      }
    >
      {ticks}
    </div>
  )
}

function applyPrintPageSize(settings: LabelSettings) {
  let style = document.getElementById('label-print-page') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'label-print-page'
    document.head.appendChild(style)
  }
  const w = settings.width
  const h = settings.height
  const rotated = settings.orientation === 90 || settings.orientation === 270
  const pageW = rotated ? h : w
  const pageH = rotated ? w : h
  style.textContent = `
    @page {
      size: ${pageW}mm ${pageH}mm;
      margin: 0;
    }
  `
  document.documentElement.style.setProperty('--label-w', `${w}mm`)
  document.documentElement.style.setProperty('--label-h', `${h}mm`)
}

export default function App() {
  const [view, setView] = useState<ViewMode>('home')
  const [templates, setTemplates] = useState<LabelTemplate[]>(() => loadTemplates())
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showPrintDialog, setShowPrintDialog] = useState(false)
  const [showBatchPrintDialog, setShowBatchPrintDialog] = useState(false)
  const [printSheet, setPrintSheet] = useState<HTMLElement | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)

  const history = useHistory<LabelElement[]>([])
  const [settings, setSettings] = useState<LabelSettings>(defaultLabelSettings())
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedCells, setSelectedCells] = useState<CellPos[]>([])
  const [editingCell, setEditingCell] = useState<CellPos | null>(null)
  const [translating, setTranslating] = useState(false)
  const [zoom, setZoom] = useState(2)
  const [clipboard, setClipboard] = useState<LabelElement | null>(null)
  const dragRef = useRef<DragMode | null>(null)
  const liveCellContentRef = useRef('')
  const emptyCells = useMemo(() => [] as CellPos[], [])

  const elements = history.state
  const selected = useMemo(
    () => elements.find((e) => e.id === selectedIds[0]) ?? null,
    [elements, selectedIds],
  )

  const canTranslateCell = useMemo(() => {
    if (!selected || selected.type !== 'table' || selectedCells.length === 0)
      return false
    return selectedCells.some(({ row, col }) => {
      const cell = selected.cells[row]?.[col]
      return !!cell && !cell.covered
    })
  }, [selected, selectedCells])

  const canRemoveTranslation = useMemo(() => {
    if (!selected || selected.type !== 'table' || selectedCells.length === 0)
      return false
    return selectedCells.some(({ row, col }) => {
      const cell = selected.cells[row]?.[col]
      return !!cell && !cell.covered && cellHasTranslation(cell.content)
    })
  }, [selected, selectedCells])

  const canInsertVariable = true

  const tableCellStyle = useMemo(() => {
    if (!selected || selected.type !== 'table' || selectedCells.length === 0)
      return null
    const { row, col } = selectedCells[0]
    const cell = selected.cells[row]?.[col]
    if (!cell || cell.covered) return null
    return {
      textAlign: cell.textAlign,
      verticalAlign: cell.verticalAlign,
      fontWeight: cell.fontWeight,
      fontStyle: cell.fontStyle ?? 'normal',
      textDecoration: cell.textDecoration ?? 'none',
      color: cell.color,
    }
  }, [selected, selectedCells])

  const tableFont = useMemo(() => {
    if (!selected || selected.type !== 'table') return null
    const table = selected as TableElement
    const sample =
      selectedCells.length > 0
        ? table.cells[selectedCells[0].row]?.[selectedCells[0].col]
        : table.cells[0]?.[0]
    return {
      fontFamily: table.fontFamily,
      fontSize: sample?.fontSize ?? 9,
      fontWeight: sample?.fontWeight ?? 'normal',
      fontStyle: sample?.fontStyle ?? 'normal',
      textDecoration: sample?.textDecoration ?? 'none',
      color: sample?.color ?? '#111111',
    }
  }, [selected, selectedCells])

  const updateElements = history.set

  const bringElementToFront = useCallback(
    (id: string) => {
      updateElements(
        (list) => {
          const idx = list.findIndex((item) => item.id === id)
          if (idx < 0 || idx === list.length - 1) return list
          const next = [...list]
          const [item] = next.splice(idx, 1)
          next.push(item)
          return next
        },
        false,
      )
    },
    [updateElements],
  )

  useEffect(() => {
    if (view === 'editor') applyPrintPageSize(settings)
  }, [view, settings])

  const openEditor = (tpl: LabelTemplate) => {
    setTemplateId(tpl.id)
    setSettings(tpl.settings)
    history.reset(structuredClone(tpl.elements))
    setSelectedIds([])
    setSelectedCells([])
    setEditingCell(null)
    setZoom(fitZoom(tpl.settings.width, tpl.settings.height))
    setView('editor')
  }

  const createBlank = (nextSettings: LabelSettings) => {
    const id = uuid()
    const tpl: LabelTemplate = {
      id,
      settings: nextSettings,
      elements: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setTemplates(upsertTemplate(tpl))
    openEditor(tpl)
    setShowNewDialog(false)
  }

  const goHome = () => {
    setView('home')
    setTemplateId(null)
    setSelectedIds([])
    setSelectedCells([])
    setEditingCell(null)
    setTemplates(loadTemplates())
  }

  const patchElement = useCallback(
    (
      id: string,
      patch: Partial<LabelElement> | ((el: LabelElement) => LabelElement),
      record = true,
    ) => {
      updateElements((list) =>
        list.map((el) => {
          if (el.id !== id) return el
          const next = typeof patch === 'function' ? patch(el) : { ...el, ...patch }
          if (next.type === 'table' && typeof patch !== 'function') {
            const t = next as TableElement
            if ('width' in patch || 'height' in patch) {
              return resizeTableBox(t, t.width, t.height)
            }
          }
          return next as LabelElement
        }),
      record)
    },
    [updateElements],
  )

  const setTableFontSize = useCallback(
    (fontSize: number) => {
      if (!selected || selected.type !== 'table' || !Number.isFinite(fontSize))
        return
      patchElement(selected.id, (el) => {
        const table = el as TableElement
        return selectedCells.length > 0
          ? updateCells(table, selectedCells, { fontSize })
          : updateAllCells(table, { fontSize })
      })
    },
    [selected, selectedCells, patchElement],
  )

  const applyTableCellStyle = useCallback(
    (patch: Partial<TableCell>) => {
      if (!selected || selected.type !== 'table') return
      patchElement(selected.id, (el) => {
        const table = el as TableElement
        return selectedCells.length > 0
          ? updateCells(table, selectedCells, patch)
          : updateAllCells(table, patch)
      })
    },
    [selected, selectedCells, patchElement],
  )

  const commitEditingCell = useCallback(
    (tableId: string, row: number, col: number, content: string) => {
      patchElement(tableId, (el) => {
        if (el.type !== 'table') return el
        return updateCell(el as TableElement, row, col, { content })
      })
      setEditingCell(null)
    },
    [patchElement],
  )

  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  const editingCellRef = useRef(editingCell)
  editingCellRef.current = editingCell
  const elementsRef = useRef(elements)
  elementsRef.current = elements
  const checkpointRef = useRef(history.checkpoint)
  checkpointRef.current = history.checkpoint

  const flushEditingCell = useCallback(() => {
    const cell = editingCellRef.current
    if (!cell) return
    const tableId = selectedIdsRef.current[0]
    if (!tableId) {
      setEditingCell(null)
      return
    }
    commitEditingCell(tableId, cell.row, cell.col, liveCellContentRef.current)
  }, [commitEditingCell])

  useEffect(() => {
    if (view !== 'editor' || !editingCell) return
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('.cell-edit[contenteditable="true"]')) return
      if (target.closest('.table-el td')) return
      flushEditingCell()
    }
    document.addEventListener('mousedown', onDocMouseDown, true)
    return () => document.removeEventListener('mousedown', onDocMouseDown, true)
  }, [view, editingCell, flushEditingCell])

  const addElement = (type: ElementType | 'image' | 'date' | 'warning') => {
    if (type === 'image') {
      alert('图片功能可后续接入本地上传')
      return
    }
    const el = createElement(type, settings.width, settings.height)
    if (!el) return
    // 新控件置于最上层，避免被大表格挡住
    updateElements((list) => [...list, el])
    setSelectedIds([el.id])
    setSelectedCells([])
    setEditingCell(null)
  }

  const deleteSelected = () => {
    if (!selectedIds.length) return
    updateElements((list) => list.filter((e) => !selectedIds.includes(e.id)))
    setSelectedIds([])
    setSelectedCells([])
  }

  const clearSelectedTableCells = useCallback(() => {
    if (!selected || selected.type !== 'table' || selectedCells.length === 0)
      return
    patchElement(selected.id, (el) =>
      updateCells(el as TableElement, selectedCells, { content: '' }),
    )
  }, [selected, selectedCells, patchElement])

  const copySelected = () => {
    if (selected) setClipboard(structuredClone(selected))
  }

  const pasteClipboard = () => {
    if (!clipboard) return
    const cloned = {
      ...structuredClone(clipboard),
      id: uuid(),
      x: clipboard.x + 2,
      y: clipboard.y + 2,
    }
    updateElements((list) => [...list, cloned])
    setSelectedIds([cloned.id])
  }

  const onMouseDownElement = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button !== 0) return
      const el = elementsRef.current.find((x) => x.id === id)
      if (!el || el.locked) return
      e.stopPropagation()
      const inTableCell = !!(e.target as HTMLElement).closest('td')
      const inCellEditor = !!(e.target as HTMLElement).closest(
        '.cell-edit[contenteditable="true"]',
      )
      if (!inTableCell) {
        setSelectedCells([])
        if (editingCellRef.current) flushEditingCell()
        else setEditingCell(null)
      }
      setSelectedIds([id])
      bringElementToFront(id)
      checkpointRef.current()
      if (inTableCell || inCellEditor) return
      dragRef.current = {
        kind: 'move',
        id,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.x,
        origY: el.y,
        pendingX: el.x,
        pendingY: el.y,
      }
    },
    [flushEditingCell, bringElementToFront],
  )

  const onTableMoveStart = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (e.button !== 0) return
      const el = elementsRef.current.find((x) => x.id === id)
      if (!el || el.locked) return
      e.stopPropagation()
      setSelectedCells([])
      if (editingCellRef.current) flushEditingCell()
      else setEditingCell(null)
      setSelectedIds([id])
      bringElementToFront(id)
      checkpointRef.current()
      document.body.classList.add('table-moving')
      dragRef.current = {
        kind: 'move',
        id,
        startX: e.clientX,
        startY: e.clientY,
        origX: el.x,
        origY: el.y,
        pendingX: el.x,
        pendingY: el.y,
      }
    },
    [flushEditingCell, bringElementToFront],
  )

  const onResizeStart = useCallback(
    (e: React.MouseEvent, id: string, handle: ResizeHandle) => {
      e.stopPropagation()
      e.preventDefault()
      const el = elementsRef.current.find((x) => x.id === id)
      if (!el || el.locked) return
      checkpointRef.current()
      dragRef.current = {
        kind: 'resize',
        id,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        orig: { ...el },
        pendingX: el.x,
        pendingY: el.y,
        pendingW: el.width,
        pendingH: el.height,
      }
    },
    [],
  )

  const onRotateStart = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    e.preventDefault()
    const el = elementsRef.current.find((x) => x.id === id)
    if (!el || el.locked || (el.type !== 'rect' && el.type !== 'line')) return
    const node = getElementNode(id)
    if (!node) return
    const rect = node.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    checkpointRef.current()
    dragRef.current = {
      kind: 'rotate',
      id,
      centerX,
      centerY,
      startAngle: Math.atan2(e.clientY - centerY, e.clientX - centerX),
      origRotation: el.rotation,
      pendingRotation: el.rotation,
    }
  }, [])

  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  useEffect(() => {
    let raf = 0
    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const clientX = e.clientX
      const clientY = e.clientY
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        const current = dragRef.current
        if (!current) return
        const z = zoomRef.current

        if (current.kind === 'move') {
          const dx = (clientX - current.startX) / (MM_TO_PX * z)
          const dy = (clientY - current.startY) / (MM_TO_PX * z)
          const x = Math.max(0, Math.round((current.origX + dx) * 10) / 10)
          const y = Math.max(0, Math.round((current.origY + dy) * 10) / 10)
          current.pendingX = x
          current.pendingY = y
          paintElementBox(current.id, { x, y })
          return
        }

        if (current.kind === 'rotate') {
          const angle = Math.atan2(
            clientY - current.centerY,
            clientX - current.centerX,
          )
          const deltaDeg = ((angle - current.startAngle) * 180) / Math.PI
          const rotation = normalizeRotation(current.origRotation + deltaDeg)
          current.pendingRotation = rotation
          paintElementBox(current.id, { rotation })
          return
        }

        const dx = (clientX - current.startX) / (MM_TO_PX * z)
        const dy = (clientY - current.startY) / (MM_TO_PX * z)
        const o = current.orig
        let { x, y, width, height } = o
        const h = current.handle
        const minH = o.type === 'line' ? 0.3 : 2
        if (h.includes('e')) width = Math.max(2, o.width + dx)
        if (h.includes('s')) height = Math.max(minH, o.height + dy)
        if (h.includes('w')) {
          width = Math.max(2, o.width - dx)
          x = o.x + o.width - width
        }
        if (h.includes('n')) {
          height = Math.max(minH, o.height - dy)
          y = o.y + o.height - height
        }

        width = Math.round(width * 10) / 10
        height = Math.round(height * 10) / 10
        x = Math.round(x * 10) / 10
        y = Math.round(y * 10) / 10

        current.pendingX = x
        current.pendingY = y
        current.pendingW = width
        current.pendingH = height
        paintElementBox(current.id, { x, y, width, height })
      })
    }

    const onUp = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      const current = dragRef.current
      dragRef.current = null
      document.body.classList.remove('table-moving')
      if (!current) return

      if (current.kind === 'move') {
        if (
          current.pendingX !== current.origX ||
          current.pendingY !== current.origY
        ) {
          patchElement(
            current.id,
            { x: current.pendingX, y: current.pendingY },
            false,
          )
        }
        return
      }

      if (current.kind === 'rotate') {
        if (current.pendingRotation !== current.origRotation) {
          patchElement(
            current.id,
            { rotation: current.pendingRotation },
            false,
          )
        }
        return
      }

      const { pendingX: x, pendingY: y, pendingW: width, pendingH: height } =
        current
      const o = current.orig
      if (
        x === o.x &&
        y === o.y &&
        width === o.width &&
        height === o.height
      ) {
        return
      }
      patchElement(
        current.id,
        (el) => {
          if (el.type === 'table') {
            const base =
              current.orig.type === 'table'
                ? (current.orig as TableElement)
                : (el as TableElement)
            return { ...resizeTableBox(base, width, height), x, y }
          }
          return { ...el, x, y, width, height }
        },
        false,
      )
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [patchElement])

  useEffect(() => {
    if (view !== 'editor') return
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        history.undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        history.redo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        saveTemplate()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') copySelected()
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') pasteClipboard()
      if (e.key === 'F2') {
        e.preventDefault()
        if (
          selected?.type === 'table' &&
          selectedCells.length === 1 &&
          !editingCell
        ) {
          setSelectedCells([selectedCells[0]])
          setEditingCell(selectedCells[0])
        }
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (editingCell) return
        // 表格选中了单元格：清空内容，不删除整表
        if (selected?.type === 'table' && selectedCells.length > 0) {
          e.preventDefault()
          clearSelectedTableCells()
          return
        }
        // 仅选中表格本身时：退格不删表，避免误触；Delete 仍可删除
        if (selected?.type === 'table' && e.key === 'Backspace') {
          return
        }
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, selected, selectedCells, editingCell, clearSelectedTableCells, history])

  const handleSelectCell = useCallback((pos: CellPos, multi: boolean) => {
    setSelectedCells((prev) => {
      if (!multi) return [pos]
      const exists = prev.some((p) => p.row === pos.row && p.col === pos.col)
      if (exists) return prev.filter((p) => !(p.row === pos.row && p.col === pos.col))
      return [...prev, pos]
    })
  }, [])

  const handleStartEditCell = useCallback((pos: CellPos) => {
    setSelectedCells([pos])
    setEditingCell(pos)
  }, [])

  const handleCancelEditCell = useCallback(() => setEditingCell(null), [])

  const handleCellEditInput = useCallback((content: string) => {
    liveCellContentRef.current = content
  }, [])

  const handleChangeText = useCallback(
    (id: string, content: string) => {
      patchElement(id, { content } as Partial<LabelElement>)
    },
    [patchElement],
  )

  const handleTableGridResizeStart = useCallback(() => {
    checkpointRef.current()
  }, [])

  const handleTableColWidth = useCallback(
    (id: string, index: number, width: number) => {
      patchElement(
        id,
        (el) => setColWidth(el as TableElement, index, width),
        false,
      )
    },
    [patchElement],
  )

  const handleTableRowHeight = useCallback(
    (id: string, index: number, height: number) => {
      patchElement(
        id,
        (el) => setRowHeight(el as TableElement, index, height),
        false,
      )
    },
    [patchElement],
  )

  const handleTableResizeColInRows = useCallback(
    (
      id: string,
      leftIndex: number,
      leftWidth: number,
      rowStart: number,
      rowEndExclusive: number,
    ) => {
      patchElement(
        id,
        (el) =>
          resizeColInRows(
            el as TableElement,
            leftIndex,
            leftWidth,
            rowStart,
            rowEndExclusive,
          ),
        false,
      )
    },
    [patchElement],
  )

  const handleTableResizeRowInCols = useCallback(
    (
      id: string,
      topIndex: number,
      topHeight: number,
      colStart: number,
      colEndExclusive: number,
    ) => {
      patchElement(
        id,
        (el) =>
          resizeRowInCols(
            el as TableElement,
            topIndex,
            topHeight,
            colStart,
            colEndExclusive,
          ),
        false,
      )
    },
    [patchElement],
  )

  const handleTableMoveColBoundaryInRows = useCallback(
    (
      id: string,
      leftIndex: number,
      leftWidth: number,
      rowStart: number,
      rowEndExclusive: number,
      expandMerge = true,
    ) => {
      patchElement(
        id,
        (el) =>
          moveColBoundaryInRows(
            el as TableElement,
            leftIndex,
            leftWidth,
            rowStart,
            rowEndExclusive,
            expandMerge,
          ),
        false,
      )
    },
    [patchElement],
  )

  const handleTableMoveRowBoundaryInCols = useCallback(
    (
      id: string,
      topIndex: number,
      topHeight: number,
      colStart: number,
      colEndExclusive: number,
      expandMerge = true,
    ) => {
      patchElement(
        id,
        (el) =>
          moveRowBoundaryInCols(
            el as TableElement,
            topIndex,
            topHeight,
            colStart,
            colEndExclusive,
            expandMerge,
          ),
        false,
      )
    },
    [patchElement],
  )

  const handleSelectCellForElement = useCallback(
    (id: string, pos: CellPos, multi: boolean) => {
      setSelectedIds([id])
      bringElementToFront(id)
      handleSelectCell(pos, multi)
    },
    [bringElementToFront, handleSelectCell],
  )

  const handleCommitCellEditForElement = useCallback(
    (id: string, row: number, col: number, content: string) => {
      commitEditingCell(id, row, col, content)
    },
    [commitEditingCell],
  )

  const handleInsertTableRows = useCallback(
    (id: string, row: number, count: number, where: 'above' | 'below') => {
      const unit = defaultFittedTableUnitSize(settings.width, settings.height)
      patchElement(id, (el) => {
        if (el.type !== 'table') return el
        return insertRows(el as TableElement, row, count, where, unit) ?? el
      })
      // 向下插入时选区行号下移；向上插入时当前行下移
      setSelectedCells((prev) =>
        prev.map((p) => {
          if (where === 'above' && p.row >= row) {
            return { ...p, row: p.row + count }
          }
          if (where === 'below' && p.row > row) {
            return { ...p, row: p.row + count }
          }
          return p
        }),
      )
      setEditingCell((prev) => {
        if (!prev) return null
        if (where === 'above' && prev.row >= row) {
          return { ...prev, row: prev.row + count }
        }
        if (where === 'below' && prev.row > row) {
          return { ...prev, row: prev.row + count }
        }
        return prev
      })
    },
    [patchElement, settings.width, settings.height],
  )

  const handleInsertTableCols = useCallback(
    (id: string, col: number, count: number, where: 'left' | 'right') => {
      const unit = defaultFittedTableUnitSize(settings.width, settings.height)
      patchElement(id, (el) => {
        if (el.type !== 'table') return el
        return insertCols(el as TableElement, col, count, where, unit) ?? el
      })
      setSelectedCells((prev) =>
        prev.map((p) => {
          if (where === 'left' && p.col >= col) {
            return { ...p, col: p.col + count }
          }
          if (where === 'right' && p.col > col) {
            return { ...p, col: p.col + count }
          }
          return p
        }),
      )
      setEditingCell((prev) => {
        if (!prev) return null
        if (where === 'left' && prev.col >= col) {
          return { ...prev, col: prev.col + count }
        }
        if (where === 'right' && prev.col > col) {
          return { ...prev, col: prev.col + count }
        }
        return prev
      })
    },
    [patchElement, settings.width, settings.height],
  )

  const handleDeleteTableRows = useCallback(
    (id: string, row: number, count: number) => {
      const table = elementsRef.current.find((e) => e.id === id)
      const rowsBefore =
        table && table.type === 'table' ? (table as TableElement).rows : 0
      patchElement(id, (el) => {
        if (el.type !== 'table') return el
        return deleteRows(el as TableElement, row, count) ?? el
      })
      const deleteCount = Math.min(
        count,
        Math.max(0, rowsBefore - row),
        Math.max(0, rowsBefore - 1),
      )
      const end = row + deleteCount
      setSelectedCells((prev) => {
        const next = prev
          .filter((p) => p.row < row || p.row >= end)
          .map((p) =>
            p.row >= end ? { ...p, row: p.row - deleteCount } : p,
          )
        if (next.length > 0) return next
        const fallbackRow = Math.max(0, Math.min(row, rowsBefore - deleteCount - 1))
        return [{ row: fallbackRow, col: prev[0]?.col ?? 0 }]
      })
      setEditingCell((prev) => {
        if (!prev) return null
        if (prev.row >= row && prev.row < end) return null
        if (prev.row >= end) return { ...prev, row: prev.row - deleteCount }
        return prev
      })
    },
    [patchElement],
  )

  const handleDeleteTableCols = useCallback(
    (id: string, col: number, count: number) => {
      const table = elementsRef.current.find((e) => e.id === id)
      const colsBefore =
        table && table.type === 'table' ? (table as TableElement).cols : 0
      patchElement(id, (el) => {
        if (el.type !== 'table') return el
        return deleteCols(el as TableElement, col, count) ?? el
      })
      const deleteCount = Math.min(
        count,
        Math.max(0, colsBefore - col),
        Math.max(0, colsBefore - 1),
      )
      const end = col + deleteCount
      setSelectedCells((prev) => {
        const next = prev
          .filter((p) => p.col < col || p.col >= end)
          .map((p) =>
            p.col >= end ? { ...p, col: p.col - deleteCount } : p,
          )
        if (next.length > 0) return next
        const fallbackCol = Math.max(0, Math.min(col, colsBefore - deleteCount - 1))
        return [{ row: prev[0]?.row ?? 0, col: fallbackCol }]
      })
      setEditingCell((prev) => {
        if (!prev) return null
        if (prev.col >= col && prev.col < end) return null
        if (prev.col >= end) return { ...prev, col: prev.col - deleteCount }
        return prev
      })
    },
    [patchElement],
  )

  const handleMerge = () => {
    if (!selected || selected.type !== 'table') return
    const next = mergeCells(selected, selectedCells)
    if (next) {
      patchElement(selected.id, () => next)
      setSelectedCells([selectedCells[0]])
    }
  }

  const handleSplit = () => {
    if (!selected || selected.type !== 'table' || !selectedCells[0]) return
    const next = splitCell(selected, selectedCells[0])
    if (next) patchElement(selected.id, () => next)
  }

  const handleTranslateCell = useCallback(async () => {
    if (!selected || selected.type !== 'table' || selectedCells.length === 0)
      return

    const table = selected as TableElement
    const targets = selectedCells
      .map(({ row, col }) => {
        const cell = table.cells[row]?.[col]
        if (!cell || cell.covered) return null
        return { row, col, content: cell.content }
      })
      .filter(
        (t): t is { row: number; col: number; content: string } => t !== null,
      )

    if (targets.length === 0) return

    // 单格时可翻译选中片段；多选时翻译各格第一行中文
    const selection = targets.length === 1 ? getSelectedText() : ''

    setTranslating(true)
    try {
      const updates: { row: number; col: number; content: string }[] = []
      let skipped = 0
      let failCount = 0
      let lastError = ''

      for (let i = 0; i < targets.length; i++) {
        const t = targets[i]
        const sourceText = pickSourceText(
          t.content,
          targets.length === 1 ? selection : '',
        )
        if (!sourceText || !hasChinese(sourceText)) {
          skipped++
          continue
        }
        try {
          const translated = await translateZhToEn(sourceText)
          updates.push({
            row: t.row,
            col: t.col,
            content: mergeTranslationIntoCell(
              t.content,
              sourceText,
              translated,
            ),
          })
          if (i < targets.length - 1) {
            await new Promise((r) => setTimeout(r, 180))
          }
        } catch (err) {
          failCount++
          lastError = err instanceof Error ? err.message : '翻译失败'
        }
      }

      if (updates.length > 0) {
        patchElement(selected.id, (el) => {
          let next = el as TableElement
          for (const u of updates) {
            next = updateCell(next, u.row, u.col, { content: u.content })
          }
          return next
        })
      }
      window.getSelection()?.removeAllRanges()

      if (updates.length === 0) {
        if (failCount > 0) {
          alert(lastError || '翻译失败')
        } else if (skipped > 0) {
          alert(
            targets.length === 1
              ? '请先输入或选中要翻译的中文'
              : '所选单元格没有可翻译的中文',
          )
        }
      } else if (failCount > 0) {
        alert(`已翻译 ${updates.length} 个单元格，${failCount} 个失败`)
      }
    } finally {
      setTranslating(false)
    }
  }, [selected, selectedCells, patchElement])

  const handleRemoveTranslationCell = useCallback(() => {
    if (!selected || selected.type !== 'table' || selectedCells.length === 0)
      return
    patchElement(selected.id, (el) => {
      let table = el as TableElement
      for (const { row, col } of selectedCells) {
        const cell = table.cells[row]?.[col]
        if (!cell || cell.covered || !cellHasTranslation(cell.content)) continue
        table = updateCell(table, row, col, {
          content: removeTranslationFromCell(cell.content),
        })
      }
      return table
    })
    window.getSelection()?.removeAllRanges()
  }, [selected, selectedCells, patchElement])

  const handleInsertVariable = useCallback(
    (name: string) => {
      const token = variableToken(name)
      const active = document.activeElement as HTMLElement | null

      // 任意 contentEditable（文本框或单元格）：插到光标处
      if (active?.isContentEditable) {
        document.execCommand('insertText', false, token)
        const text = active.innerText
        if (active.closest('.cell-edit')) {
          liveCellContentRef.current = text
        } else if (active.closest('.text-el')) {
          const host = active.closest(
            '[data-element-id]',
          ) as HTMLElement | null
          const id = host?.dataset.elementId
          if (id) patchElement(id, { content: text }, false)
          else if (selected?.type === 'text') {
            patchElement(selected.id, { content: text }, false)
          }
        }
        return
      }

      // 右侧面板 / 任意文本输入框
      if (
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLInputElement &&
          (active.type === 'text' || active.type === 'search'))
      ) {
        const start = active.selectionStart ?? active.value.length
        const end = active.selectionEnd ?? start
        const next =
          active.value.slice(0, start) + token + active.value.slice(end)
        const caret = start + token.length

        if (selected?.type === 'table' && selectedCells[0]) {
          const { row, col } = selectedCells[0]
          patchElement(
            selected.id,
            (el) =>
              updateCell(el as TableElement, row, col, { content: next }),
            false,
          )
        } else if (selected?.type === 'text') {
          patchElement(selected.id, { content: next }, false)
        } else if (
          selected?.type === 'barcode' ||
          selected?.type === 'qrcode'
        ) {
          patchElement(selected.id, { value: next }, false)
        } else {
          // 未识别目标时仍写入输入框 DOM，避免“只能表格用”的感觉
          active.value = next
          active.dispatchEvent(new Event('input', { bubbles: true }))
        }
        requestAnimationFrame(() => {
          active.focus()
          active.setSelectionRange(caret, caret)
        })
        return
      }

      // 选中文本 / 条码 / 二维码：追加变量
      if (selected && !selected.locked) {
        if (selected.type === 'table' && selectedCells.length > 0) {
          patchElement(selected.id, (el) => {
            let table = el as TableElement
            for (const pos of selectedCells) {
              const cell = table.cells[pos.row]?.[pos.col]
              if (!cell || cell.covered) continue
              table = updateCell(table, pos.row, pos.col, {
                content: cell.content ? `${cell.content}${token}` : token,
              })
            }
            return table
          })
          return
        }
        if (selected.type === 'text') {
          patchElement(selected.id, {
            content: `${selected.content || ''}${token}`,
          })
          return
        }
        if (selected.type === 'barcode' || selected.type === 'qrcode') {
          patchElement(selected.id, {
            value: `${selected.value || ''}${token}`,
          })
          return
        }
      }

      // 未选中可用目标：新建文本元素放入变量（表格外同样可用）
      const el = createTextElement(5, 5)
      el.content = token
      el.width = Math.max(20, name.length * 4 + 8)
      updateElements((list) => [...list, el])
      setSelectedIds([el.id])
      setSelectedCells([])
      setEditingCell(null)
    },
    [selected, selectedCells, patchElement, updateElements],
  )

  const saveTemplate = () => {
    if (!templateId) return
    const tpl: LabelTemplate = {
      id: templateId,
      settings,
      elements: structuredClone(elements),
      createdAt:
        templates.find((t) => t.id === templateId)?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    setTemplates(upsertTemplate(tpl))
    alert('模板已保存')
  }

  const exportOneTemplate = async (tpl: LabelTemplate) => {
    try {
      const result = await exportTemplateFile(tpl)
      if (result.cancelled) return
      if (result.ok) {
        alert(result.path ? `模板已导出到：\n${result.path}` : '模板已导出')
      } else {
        alert('导出失败，请重试')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '导出失败')
    }
  }

  const exportCurrentTemplate = async () => {
    if (!templateId) return
    const tpl: LabelTemplate = {
      id: templateId,
      settings,
      elements: structuredClone(elements),
      createdAt:
        templates.find((t) => t.id === templateId)?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    }
    // 导出前顺带写入本地库，避免文件与当前编辑不一致
    setTemplates(upsertTemplate(tpl))
    await exportOneTemplate(tpl)
  }

  const importTemplate = async () => {
    try {
      const content = await pickTemplateFileContent()
      if (content == null) return
      const parsed = parseTemplateFile(content)
      const existing = loadTemplates()
      const next = prepareImportedTemplate(parsed, existing)
      setTemplates(upsertTemplate(next))
      if (confirm(`已添加模板「${next.settings.name}」，是否立即打开？`)) {
        openEditor(next)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '导入失败')
    }
  }

  const sheetRadius =
    settings.shape === 'circle'
      ? '50%'
      : settings.shape === 'round-rect'
        ? mmStyle(3)
        : '0'

  /** 画布留白，避免贴边控件的缩放锚点被裁切 */
  const canvasPad = 14

  if (view === 'home') {
    return (
      <>
        <HomeScreen
          templates={templates}
          onNew={() => setShowNewDialog(true)}
          onOpen={openEditor}
          onDelete={(id) => setTemplates(deleteTemplate(id))}
          onRename={(id, name) => setTemplates(renameTemplate(id, name))}
          onExport={(tpl) => void exportOneTemplate(tpl)}
          onImport={() => void importTemplate()}
        />
        <NewLabelDialog
          key={showNewDialog ? nextDefaultName(templates) : 'closed'}
          open={showNewDialog}
          defaultName={nextDefaultName(templates)}
          onClose={() => setShowNewDialog(false)}
          onConfirm={createBlank}
        />
      </>
    )
  }

  return (
    <div className="app">
      <TopToolbar
        zoom={zoom}
        onZoom={setZoom}
        canUndo={history.canUndo}
        canRedo={history.canRedo}
        onUndo={history.undo}
        onRedo={history.redo}
        onDelete={deleteSelected}
        onCopy={copySelected}
        onPaste={pasteClipboard}
        onSelectAll={() => setSelectedIds(elements.map((e) => e.id))}
        onRotate={() => {
          if (selected && canRotateElement(selected))
            patchElement(selected.id, rotateElementBy90(selected))
        }}
        onPrint={() => {
          const sheet = document.querySelector('.label-sheet') as HTMLElement | null
          if (!sheet) return
          setPrintSheet(sheet)
          setShowPrintDialog(true)
        }}
        onBatchPrint={() => setShowBatchPrintDialog(true)}
        onSave={saveTemplate}
        onExportTemplate={() => void exportCurrentTemplate()}
        onHome={goHome}
        onOpenSettings={() => setShowSettingsDialog(true)}
        selected={selected}
        onUpdateSelected={(patch) => {
          if (!selected) return
          patchElement(selected.id, patch as Partial<LabelElement>)
        }}
        settings={settings}
        locked={!!selected?.locked}
        onToggleLock={() => {
          if (selected) patchElement(selected.id, { locked: !selected.locked })
        }}
        canTranslateCell={canTranslateCell}
        translating={translating}
        onTranslateCell={handleTranslateCell}
        canRemoveTranslation={canRemoveTranslation}
        onRemoveTranslationCell={handleRemoveTranslationCell}
        canInsertVariable={canInsertVariable}
        onInsertVariable={handleInsertVariable}
        tableCellStyle={tableCellStyle}
        onUpdateTableCellStyle={applyTableCellStyle}
        tableFont={tableFont}
        onSetTableFontSize={setTableFontSize}
      />

      <div className="workspace">
        <LeftToolbox onAdd={addElement} />

        <div className="canvas-area">
          <div className="canvas-stage">
            <Ruler lengthMm={settings.width} zoom={zoom} />
            <Ruler lengthMm={settings.height} zoom={zoom} vertical />
            <div
              className="label-scale-slot"
              style={{
                  width: mmToPx(settings.width) * zoom + canvasPad * 2,
                  height: mmToPx(settings.height) * zoom + canvasPad * 2,
              }}
            >
              <div
                className="label-scale-wrap"
                style={{
                  top: canvasPad,
                  left: canvasPad,
                  width: mmToPx(settings.width),
                  height: mmToPx(settings.height),
                  transform: `scale(${zoom})`,
                  // 必须是无单位数字；React 对 number 会加成 px，导致 1/zoom 失效
                  ['--ui-zoom' as string]: String(zoom),
                }}
              >
                <div
                  className="label-sheet"
                  style={{
                    width: mmToPx(settings.width),
                    height: mmToPx(settings.height),
                    borderRadius: sheetRadius,
                  }}
                  onMouseDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    flushEditingCell()
                    setSelectedIds([])
                    setSelectedCells([])
                  }}
                >
                  {elements.length === 0 && (
                    <div className="blank-canvas-hint">
                      空白标签 · {settings.width} × {settings.height} mm
                      <br />
                      从左侧添加工具开始设计
                    </div>
                  )}
                  {elements.map((el, index) => (
                    <ElementView
                      key={el.id}
                      element={el}
                      zIndex={index + 1}
                      selected={selectedIds.includes(el.id)}
                      selectedCells={
                        selectedIds[0] === el.id ? selectedCells : emptyCells
                      }
                      editingCell={
                        selectedIds[0] === el.id ? editingCell : null
                      }
                      onMouseDown={onMouseDownElement}
                      onResizeStart={onResizeStart}
                      onRotateStart={onRotateStart}
                      onSelectCell={handleSelectCellForElement}
                      onStartEditCell={handleStartEditCell}
                      onCommitCellEdit={handleCommitCellEditForElement}
                      onCellEditInput={handleCellEditInput}
                      onCancelEditCell={handleCancelEditCell}
                      onChangeText={handleChangeText}
                      zoom={zoom}
                      onTableGridResizeStart={handleTableGridResizeStart}
                      onTableColWidth={handleTableColWidth}
                      onTableRowHeight={handleTableRowHeight}
                      onTableResizeColInRows={handleTableResizeColInRows}
                      onTableResizeRowInCols={handleTableResizeRowInCols}
                      onTableMoveColBoundaryInRows={
                        handleTableMoveColBoundaryInRows
                      }
                      onTableMoveRowBoundaryInCols={
                        handleTableMoveRowBoundaryInCols
                      }
                      onTableMoveStart={onTableMoveStart}
                      onInsertTableRows={handleInsertTableRows}
                      onInsertTableCols={handleInsertTableCols}
                      onDeleteTableRows={handleDeleteTableRows}
                      onDeleteTableCols={handleDeleteTableCols}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="zoom-badge">
            {settings.width}×{settings.height}mm · {Math.round(zoom * 100)}%
          </div>
        </div>

        <RightPanel
          selected={selected}
          selectedCells={selectedCells}
          onUpdate={(patch, record = true) => {
            if (!selected) return
            patchElement(selected.id, patch, record)
          }}
          onUpdateCommit={() => history.checkpoint()}
          onMerge={handleMerge}
          onSplit={handleSplit}
          onSetRows={(n) => {
            if (!selected || selected.type !== 'table') return
            const next = Math.min(MAX_TABLE_ROWS, Math.max(1, n))
            const unit = defaultFittedTableUnitSize(
              settings.width,
              settings.height,
            )
            patchElement(selected.id, (el) =>
              setTableRows(el as TableElement, next, unit),
            )
            setSelectedCells((prev) =>
              prev.filter((p) => p.row < next && p.col < selected.cols),
            )
            setEditingCell((prev) =>
              prev && prev.row < next && prev.col < selected.cols ? prev : null,
            )
          }}
          onSetCols={(n) => {
            if (!selected || selected.type !== 'table') return
            const next = Math.min(MAX_TABLE_COLS, Math.max(1, n))
            const unit = defaultFittedTableUnitSize(
              settings.width,
              settings.height,
            )
            patchElement(selected.id, (el) =>
              setTableCols(el as TableElement, next, unit),
            )
            setSelectedCells((prev) =>
              prev.filter((p) => p.row < selected.rows && p.col < next),
            )
            setEditingCell((prev) =>
              prev && prev.row < selected.rows && prev.col < next ? prev : null,
            )
          }}
          onSetRowHeight={(i, h) => {
            if (!selected || selected.type !== 'table') return
            patchElement(selected.id, (el) =>
              setRowHeight(el as TableElement, i, h),
            )
          }}
          onSetColWidth={(i, w) => {
            if (!selected || selected.type !== 'table') return
            patchElement(selected.id, (el) =>
              setColWidth(el as TableElement, i, w),
            )
          }}
          onUpdateCellStyle={applyTableCellStyle}
          onUpdateCellContent={(content, record = false) => {
            if (!selected || selected.type !== 'table' || !selectedCells[0])
              return
            const { row, col } = selectedCells[0]
            patchElement(
              selected.id,
              (el) => updateCell(el as TableElement, row, col, { content }),
              record,
            )
          }}
          onUpdateCellCommit={() => history.checkpoint()}
          onTranslateCell={handleTranslateCell}
          onRemoveTranslationCell={handleRemoveTranslationCell}
          canRemoveTranslation={canRemoveTranslation}
          translating={translating}
          onSetTableFontSize={setTableFontSize}
        />
      </div>

      <NewLabelDialog
        key={showSettingsDialog ? 'settings' : 'settings-closed'}
        open={showSettingsDialog}
        defaultName={settings.name}
        initial={settings}
        title="标签设置"
        confirmText="确定"
        onClose={() => setShowSettingsDialog(false)}
        onConfirm={(next) => {
          setSettings(next)
          setShowSettingsDialog(false)
        }}
      />

      <PrintDialog
        open={showPrintDialog}
        sheet={printSheet}
        settings={settings}
        onClose={() => setShowPrintDialog(false)}
      />

      <BatchPrintDialog
        open={showBatchPrintDialog}
        elements={elements}
        settings={settings}
        onClose={() => setShowBatchPrintDialog(false)}
      />
    </div>
  )
}

function fitZoom(widthMm: number, heightMm: number) {
  const availW = Math.max(320, window.innerWidth - 72 - 260 - 120)
  const availH = Math.max(240, window.innerHeight - 44 - 40 - 120)
  const zx = availW / (widthMm * MM_TO_PX)
  const zy = availH / (heightMm * MM_TO_PX)
  const z = Math.min(zx, zy, 4)
  return Math.max(0.5, Math.round(z * 100) / 100)
}

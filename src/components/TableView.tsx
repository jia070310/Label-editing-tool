import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { CellPos, TableCell, TableElement as TableEl } from '../types'
import { MM_TO_PX, mmStyle, ptStyle } from '../utils/dpi'
import { textEmphasisClassName, textEmphasisStyle } from '../utils/textStyle'
import {
  alignMergedGeometry,
  ensureRowColHeights,
  ensureRowColWidths,
  getCellBox,
  getRowColWidths,
  buildColSegmentsLayout,
  buildRowSegmentsLayout,
  findAlignedColRowSpan,
  findAlignedRowColSpan,
  findColAtRowBoundaryX,
  findRowAtColBoundaryY,
  type GridLineSegment,
} from '../utils/table'
import {
  TableRowContextMenu,
  type InsertColWhere,
  type InsertRowWhere,
} from './TableRowContextMenu'

function flexAlign(cell: TableCell): CSSProperties {
  const justifyContent =
    cell.textAlign === 'left'
      ? 'flex-start'
      : cell.textAlign === 'right'
        ? 'flex-end'
        : 'center'
  const alignItems =
    cell.verticalAlign === 'top'
      ? 'flex-start'
      : cell.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'center'
  return { justifyContent, alignItems }
}

type GridDrag =
  | {
      kind: 'col'
      index: number
      startX: number
      startWidth: number
      mode: 'resize'
      rowStart: number
      rowEndExclusive: number
    }
  | {
      kind: 'col'
      index: number
      startX: number
      startWidth: number
      mode: 'move'
      rowStart: number
      rowEndExclusive: number
      expandMerge: boolean
    }
  | {
      kind: 'row'
      index: number
      startY: number
      startHeight: number
      mode: 'resize'
      colStart: number
      colEndExclusive: number
      edge?: 'top' | 'bottom'
    }
  | {
      kind: 'row'
      index: number
      startY: number
      startHeight: number
      mode: 'move'
      colStart: number
      colEndExclusive: number
      expandMerge: boolean
      edge?: 'top' | 'bottom'
    }

type GridHit =
  | { kind: 'cross'; colIndex: number; rowIndex: number }
  | {
      kind: 'col'
      index: number
      segKey: string
      spanStart: number
      spanEnd: number
    }
  | {
      kind: 'row'
      index: number
      segKey: string
      spanStart: number
      spanEnd: number
      edge?: 'top' | 'bottom'
    }

function makeSegKey(seg: GridLineSegment) {
  return `${seg.edge ?? 'mid'}:${seg.index}:${seg.spanStart}-${seg.spanEnd}:${seg.posPct.toFixed(2)}`
}

/** 仅命中实际可见表格线（合并格内部的假线不命中） */
function findGridHit(
  wrap: HTMLElement,
  clientX: number,
  clientY: number,
  colSegments: GridLineSegment[],
  rowSegments: GridLineSegment[],
  preferLineOnly = false,
  hitSlop = 8,
): GridHit | null {
  const rect = wrap.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  const x = clientX - rect.left
  const y = clientY - rect.top
  if (
    x < -hitSlop ||
    y < -hitSlop ||
    x > rect.width + hitSlop ||
    y > rect.height + hitSlop
  ) {
    return null
  }

  const nearCol: { seg: GridLineSegment; d: number }[] = []
  for (const seg of colSegments) {
    const px = (seg.posPct / 100) * rect.width
    const y0 = (seg.startPct / 100) * rect.height
    const y1 = (seg.endPct / 100) * rect.height
    const d = Math.abs(x - px)
    if (d <= hitSlop && y >= y0 - hitSlop && y <= y1 + hitSlop) {
      nearCol.push({ seg, d })
    }
  }

  const nearRow: { seg: GridLineSegment; d: number }[] = []
  for (const seg of rowSegments) {
    const py = (seg.posPct / 100) * rect.height
    const x0 = (seg.startPct / 100) * rect.width
    const x1 = (seg.endPct / 100) * rect.width
    const d = Math.abs(y - py)
    // 顶/底边略放宽，但仍限制在细带内，避免整行都变成 row-resize
    const slop =
      seg.edge === 'top' || seg.edge === 'bottom' ? hitSlop + 2 : hitSlop
    if (d <= slop && x >= x0 - hitSlop && x <= x1 + hitSlop) {
      nearRow.push({ seg, d })
    }
  }

  let bestCross: {
    colIndex: number
    rowIndex: number
    dist: number
  } | null = null
  for (const c of nearCol) {
    for (const r of nearRow) {
      const cx = (c.seg.posPct / 100) * rect.width
      const cy = (r.seg.posPct / 100) * rect.height
      const y0 = (c.seg.startPct / 100) * rect.height
      const y1 = (c.seg.endPct / 100) * rect.height
      const x0 = (r.seg.startPct / 100) * rect.width
      const x1 = (r.seg.endPct / 100) * rect.width
      if (cy < y0 - 1 || cy > y1 + 1 || cx < x0 - 1 || cx > x1 + 1) continue
      const dist = Math.hypot(x - cx, y - cy)
      if (dist <= hitSlop + 2 && (!bestCross || dist < bestCross.dist)) {
        bestCross = {
          colIndex: c.seg.index,
          rowIndex: r.seg.index,
          dist,
        }
      }
    }
  }
  if (bestCross && !preferLineOnly) {
    const lineDist = Math.min(
      nearCol[0]?.d ?? Infinity,
      nearRow[0]?.d ?? Infinity,
    )
    if (lineDist >= bestCross.dist) {
      return {
        kind: 'cross',
        colIndex: bestCross.colIndex,
        rowIndex: bestCross.rowIndex,
      }
    }
  }

  nearCol.sort((a, b) => a.d - b.d)
  nearRow.sort((a, b) => {
    if (a.d !== b.d) return a.d - b.d
    const aEdge = a.seg.edge ? 0 : 1
    const bEdge = b.seg.edge ? 0 : 1
    return aEdge - bEdge
  })
  if (nearCol[0] && nearRow[0]) {
    if (nearCol[0].d <= nearRow[0].d) {
      return {
        kind: 'col',
        index: nearCol[0].seg.index,
        segKey: makeSegKey(nearCol[0].seg),
        spanStart: nearCol[0].seg.spanStart,
        spanEnd: nearCol[0].seg.spanEnd,
      }
    }
    return {
      kind: 'row',
      index: nearRow[0].seg.index,
      segKey: makeSegKey(nearRow[0].seg),
      spanStart: nearRow[0].seg.spanStart,
      spanEnd: nearRow[0].seg.spanEnd,
      edge: nearRow[0].seg.edge,
    }
  }
  if (nearCol[0]) {
    return {
      kind: 'col',
      index: nearCol[0].seg.index,
      segKey: makeSegKey(nearCol[0].seg),
      spanStart: nearCol[0].seg.spanStart,
      spanEnd: nearCol[0].seg.spanEnd,
    }
  }
  if (nearRow[0]) {
    return {
      kind: 'row',
      index: nearRow[0].seg.index,
      segKey: makeSegKey(nearRow[0].seg),
      spanStart: nearRow[0].seg.spanStart,
      spanEnd: nearRow[0].seg.spanEnd,
      edge: nearRow[0].seg.edge,
    }
  }
  return null
}

interface Props {
  element: TableEl
  selected: boolean
  selectedCells: CellPos[]
  editingCell: CellPos | null
  zoom: number
  onSelectCell: (pos: CellPos, multi: boolean) => void
  onStartEdit: (pos: CellPos) => void
  onCommitEdit: (row: number, col: number, content: string) => void
  onEditInput: (content: string) => void
  onCancelEdit: () => void
  onGridResizeStart: () => void
  onGridResizeCol: (index: number, width: number) => void
  onGridResizeRow: (index: number, height: number) => void
  onGridResizeColInRows: (
    leftIndex: number,
    leftWidth: number,
    rowStart: number,
    rowEndExclusive: number,
  ) => void
  onGridResizeRowInCols: (
    topIndex: number,
    topHeight: number,
    colStart: number,
    colEndExclusive: number,
  ) => void
  onGridResizeTopEdgeInCols: (
    topHeight: number,
    colStart: number,
    colEndExclusive: number,
  ) => void
  /** Alt：只移动「对齐且连续」的整段边界（垂直：成对调左右列宽；水平：成对调上下行高） */
  onGridMoveColBoundaryInRows: (
    leftIndex: number,
    leftWidth: number,
    rowStart: number,
    rowEndExclusive: number,
    expandMerge?: boolean,
  ) => void
  /** Alt：只移动「对齐且连续」的整段边界（水平：成对调上下行高） */
  onGridMoveRowBoundaryInCols: (
    topIndex: number,
    topHeight: number,
    colStart: number,
    colEndExclusive: number,
    expandMerge?: boolean,
  ) => void
  onTableMoveStart: (e: ReactMouseEvent) => void
  onInsertRows: (row: number, count: number, where: InsertRowWhere) => void
  onInsertCols: (col: number, count: number, where: InsertColWhere) => void
  onDeleteRows: (row: number, count: number) => void
  onDeleteCols: (col: number, count: number) => void
}

export const TableView = memo(function TableView({
  element,
  selected,
  selectedCells,
  editingCell,
  zoom,
  onSelectCell,
  onStartEdit,
  onCommitEdit,
  onEditInput,
  onCancelEdit,
  onGridResizeStart,
  onGridResizeCol,
  onGridResizeRow,
  onGridResizeColInRows,
  onGridResizeRowInCols,
  onGridResizeTopEdgeInCols,
  onGridMoveColBoundaryInRows,
  onGridMoveRowBoundaryInCols,
  onTableMoveStart,
  onInsertRows,
  onInsertCols,
  onDeleteRows,
  onDeleteCols,
}: Props) {
  const editRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLDivElement>(null)
  const gridDragRef = useRef<GridDrag | null>(null)
  const [hoverHit, setHoverHit] = useState<GridHit | null>(null)
  const [rowMenu, setRowMenu] = useState<{
    x: number
    y: number
    row: number
    col: number
  } | null>(null)

  const layout = useMemo(
    () =>
      alignMergedGeometry(
        ensureRowColHeights(ensureRowColWidths(element)),
      ),
    [element],
  )
  const totalW = useMemo(() => {
    if (layout.width > 0) return layout.width
    const fromRows = layout.rowColWidths?.length
      ? Math.max(
          ...layout.rowColWidths.map((r) => r.reduce((a, b) => a + b, 0)),
          0,
        )
      : 0
    return fromRows || layout.colWidths.reduce((a, b) => a + b, 0) || 1
  }, [layout.width, layout.rowColWidths, layout.colWidths])
  const totalH = useMemo(() => {
    // 必须用锁定外框高，不能用 max(行高) 之和：
    // Alt+Q 只改一列时后者会变大，百分比布局会把整表往反方向压
    if (layout.height > 0) return layout.height
    if (layout.rowColHeights?.length && layout.cols > 0) {
      let max = 0
      for (let c = 0; c < layout.cols; c++) {
        let h = 0
        for (let r = 0; r < layout.rows; r++) {
          h += layout.rowColHeights[r]?.[c] ?? layout.rowHeights[r] ?? 0
        }
        max = Math.max(max, h)
      }
      if (max > 0) return max
    }
    return layout.rowHeights.reduce((a, b) => a + b, 0) || 1
  }, [
    layout.height,
    layout.rowColHeights,
    layout.rowHeights,
    layout.cols,
    layout.rows,
  ])

  const showGridResizers = selected && !layout.locked && !editingCell

  const qKeyRef = useRef(false)
  useEffect(() => {
    const isQ = (e: KeyboardEvent) =>
      e.code === 'KeyQ' || e.key === 'q' || e.key === 'Q'
    const onKeyDown = (e: KeyboardEvent) => {
      if (isQ(e)) qKeyRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (isQ(e)) qKeyRef.current = false
      if (e.key === 'Alt') qKeyRef.current = false
    }
    const onBlur = () => {
      qKeyRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  const colSegments = useMemo(
    () => (showGridResizers ? buildColSegmentsLayout(layout) : []),
    [showGridResizers, layout],
  )
  const rowSegments = useMemo(
    () => (showGridResizers ? buildRowSegmentsLayout(layout) : []),
    [showGridResizers, layout],
  )
  const rowSegmentsVisual = useMemo(
    () => rowSegments.filter((seg) => !seg.edge),
    [rowSegments],
  )

  const gridCrosses = useMemo(() => {
    const crosses: {
      colIndex: number
      rowIndex: number
      leftPct: number
      topPct: number
    }[] = []
    for (const c of colSegments) {
      for (const r of rowSegmentsVisual) {
        if (r.posPct < c.startPct - 0.01 || r.posPct > c.endPct + 0.01) continue
        if (c.posPct < r.startPct - 0.01 || c.posPct > r.endPct + 0.01) continue
        crosses.push({
          colIndex: c.index,
          rowIndex: r.index,
          leftPct: c.posPct,
          topPct: r.posPct,
        })
      }
    }
    const seen = new Set<string>()
    return crosses.filter((x) => {
      if (x.topPct <= 0.01 || x.topPct >= 99.99) return false
      if (x.leftPct <= 0.01 || x.leftPct >= 99.99) return false
      const k = `${x.colIndex}-${x.rowIndex}-${x.leftPct.toFixed(2)}-${x.topPct.toFixed(2)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [colSegments, rowSegmentsVisual])

  useEffect(() => {
    if (!showGridResizers) setHoverHit(null)
  }, [showGridResizers])

  useEffect(() => {
    if (!editingCell || !editRef.current) return
    const cell = element.cells[editingCell.row]?.[editingCell.col]
    if (!cell) return
    editRef.current.innerText = cell.content
    onEditInput(cell.content)
    editRef.current.focus()
    const range = document.createRange()
    range.selectNodeContents(editRef.current)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editingCell?.row, editingCell?.col, element.id])

  useEffect(() => {
    let raf = 0
    const onMove = (e: MouseEvent) => {
      const drag = gridDragRef.current
      if (!drag) return
      const clientX = e.clientX
      const clientY = e.clientY
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        raf = 0
        const current = gridDragRef.current
        if (!current) return
        const scale = MM_TO_PX * zoom
        if (current.kind === 'col') {
          const dx = (clientX - current.startX) / scale
          const nextW = Math.max(
            4,
            Math.round((current.startWidth + dx) * 100) / 100,
          )
          if (current.mode === 'move') {
            onGridMoveColBoundaryInRows(
              current.index,
              nextW,
              current.rowStart,
              current.rowEndExclusive,
              current.expandMerge,
            )
          } else {
            onGridResizeColInRows(
              current.index,
              nextW,
              current.rowStart,
              current.rowEndExclusive,
            )
          }
        } else {
          const dy = (clientY - current.startY) / scale
          if (current.edge === 'top') {
            const nextH = Math.max(
              2,
              Math.round((current.startHeight - dy) * 100) / 100,
            )
            onGridResizeTopEdgeInCols(
              nextH,
              current.colStart,
              current.colEndExclusive,
            )
          } else if (current.mode === 'move') {
            const nextH = Math.max(
              2,
              Math.round((current.startHeight + dy) * 100) / 100,
            )
            onGridMoveRowBoundaryInCols(
              current.index,
              nextH,
              current.colStart,
              current.colEndExclusive,
              current.expandMerge,
            )
          } else {
            const nextH = Math.max(
              2,
              Math.round((current.startHeight + dy) * 100) / 100,
            )
            onGridResizeRowInCols(
              current.index,
              nextH,
              current.colStart,
              current.colEndExclusive,
            )
          }
        }
      })
    }
    const onUp = () => {
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      gridDragRef.current = null
      document.body.classList.remove(
        'table-grid-resizing',
        'table-grid-resizing-col',
        'table-grid-resizing-row',
        'table-grid-resizing-pair',
      )
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.classList.remove(
        'table-grid-resizing',
        'table-grid-resizing-col',
        'table-grid-resizing-row',
        'table-grid-resizing-pair',
      )
    }
  }, [
    zoom,
    onGridResizeCol,
    onGridResizeRow,
    onGridResizeColInRows,
    onGridResizeRowInCols,
    onGridResizeTopEdgeInCols,
    onGridMoveColBoundaryInRows,
    onGridMoveRowBoundaryInCols,
  ])

  const isSelected = (r: number, c: number) =>
    selectedCells.some((p) => p.row === r && p.col === c)

  const beginGridDrag = (cursorClass: string, pair: boolean) => {
    onGridResizeStart()
    document.body.classList.add('table-grid-resizing', cursorClass)
    if (pair) document.body.classList.add('table-grid-resizing-pair')
  }

  const startColResize = (
    e: ReactMouseEvent,
    index: number,
    spanStart: number,
    spanEnd: number,
  ) => {
    e.preventDefault()
    e.stopPropagation()
    // 锚点取光标所在行，而不是高亮线段的起点（避免 Alt+Q 挪错行）
    let anchorRow = Math.max(0, Math.min(layout.rows - 1, Math.floor(spanStart)))
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      if (rect.height > 0) {
        const yMm = ((e.clientY - rect.top) / rect.height) * totalH
        anchorRow = findRowAtColBoundaryY(
          layout,
          index,
          spanStart,
          spanEnd,
          yMm,
        )
      }
    }
    const widths = getRowColWidths(layout, anchorRow)
    const startWidth = widths[index] ?? layout.colWidths[index] ?? 20
    // 中间竖线：默认左右对调、外框不变；Alt=改变表格总宽
    const isMove = !e.altKey
    const singleSegment = e.altKey && qKeyRef.current
    const range = singleSegment
      ? { rowStart: anchorRow, rowEnd: anchorRow + 1 }
      : findAlignedColRowSpan(layout, index, anchorRow)
    if (isMove) {
      beginGridDrag('table-grid-resizing-col', true)
      gridDragRef.current = {
        kind: 'col',
        index,
        startX: e.clientX,
        startWidth,
        mode: 'move',
        rowStart: range.rowStart,
        rowEndExclusive: range.rowEnd,
        expandMerge: !singleSegment,
      }
    } else if (singleSegment) {
      // Alt+Q：只挪当前小段（仍保持该段所在行总宽）
      beginGridDrag('table-grid-resizing-col', true)
      gridDragRef.current = {
        kind: 'col',
        index,
        startX: e.clientX,
        startWidth,
        mode: 'move',
        rowStart: range.rowStart,
        rowEndExclusive: range.rowEnd,
        expandMerge: false,
      }
    } else {
      beginGridDrag('table-grid-resizing-col', false)
      gridDragRef.current = {
        kind: 'col',
        index,
        startX: e.clientX,
        startWidth,
        mode: 'resize',
        rowStart: range.rowStart,
        rowEndExclusive: range.rowEnd,
      }
    }
  }

  const startRowResize = (
    e: ReactMouseEvent,
    index: number,
    spanStart: number,
    spanEnd: number,
    edge?: 'top' | 'bottom',
  ) => {
    e.preventDefault()
    e.stopPropagation()
    const rowIndex =
      edge === 'bottom'
        ? layout.rows - 1
        : edge === 'top'
          ? 0
          : index
    const boundaryIndex =
      edge === 'bottom'
        ? Math.max(0, layout.rows - 2)
        : index
    // 锚点取光标所在列，而不是高亮线段的起点
    let anchorCol = Math.max(0, Math.min(layout.cols - 1, Math.floor(spanStart)))
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect()
      if (rect.width > 0) {
        const xMm = ((e.clientX - rect.left) / rect.width) * totalW
        anchorCol = findColAtRowBoundaryX(
          layout,
          boundaryIndex,
          spanStart,
          spanEnd,
          xMm,
        )
      }
    }
    // 顶/底边：改外框高；中间横线：默认上下对调、外框不变；Alt=改变表格总高
    let isMove = !e.altKey
    if (edge === 'top' || edge === 'bottom') isMove = false
    const singleSegment = e.altKey && qKeyRef.current
    const range = singleSegment
      ? { colStart: anchorCol, colEnd: anchorCol + 1 }
      : findAlignedRowColSpan(layout, boundaryIndex, anchorCol)
    const startHeight =
      layout.rowColHeights?.[
        isMove ? boundaryIndex : rowIndex
      ]?.[anchorCol] ??
      layout.rowHeights[isMove ? boundaryIndex : rowIndex] ??
      8
    const dragIndex = isMove ? boundaryIndex : rowIndex
    if (isMove) {
      beginGridDrag('table-grid-resizing-row', true)
      gridDragRef.current = {
        kind: 'row',
        index: dragIndex,
        startY: e.clientY,
        startHeight,
        mode: 'move',
        colStart: range.colStart,
        colEndExclusive: range.colEnd,
        expandMerge: !singleSegment,
        edge,
      }
    } else if (singleSegment) {
      beginGridDrag('table-grid-resizing-row', true)
      gridDragRef.current = {
        kind: 'row',
        index: boundaryIndex,
        startY: e.clientY,
        startHeight:
          layout.rowColHeights?.[boundaryIndex]?.[anchorCol] ??
          layout.rowHeights[boundaryIndex] ??
          8,
        mode: 'move',
        colStart: range.colStart,
        colEndExclusive: range.colEnd,
        expandMerge: false,
        edge,
      }
    } else {
      beginGridDrag('table-grid-resizing-row', false)
      gridDragRef.current = {
        kind: 'row',
        index: dragIndex,
        startY: e.clientY,
        startHeight,
        mode: 'resize',
        colStart: range.colStart,
        colEndExclusive: range.colEnd,
        edge,
      }
    }
  }

  const startCrossMove = (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onTableMoveStart(e)
  }

  const hitAt = (
    clientX: number,
    clientY: number,
    preferLineOnly = false,
  ) => {
    if (!wrapRef.current || !showGridResizers) return null
    // getBoundingClientRect 已是屏幕像素；勿再 /zoom，否则缩小时命中带过大、整表都像在拖线
    return findGridHit(
      wrapRef.current,
      clientX,
      clientY,
      colSegments,
      rowSegments,
      preferLineOnly,
      6,
    )
  }

  const hoverRafRef = useRef(0)
  const handleWrapMouseMove = (e: ReactMouseEvent) => {
    if (!showGridResizers || gridDragRef.current) return
    const { clientX, clientY } = e
    if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current)
    hoverRafRef.current = requestAnimationFrame(() => {
      hoverRafRef.current = 0
      const next = hitAt(clientX, clientY)
      setHoverHit((prev) => {
        if (prev === next) return prev
        if (!prev || !next) return next
        if (prev.kind !== next.kind) return next
        if (prev.kind === 'cross' && next.kind === 'cross') {
          return prev.colIndex === next.colIndex &&
            prev.rowIndex === next.rowIndex
            ? prev
            : next
        }
        if (prev.kind === 'col' && next.kind === 'col') {
          return prev.index === next.index && prev.segKey === next.segKey
            ? prev
            : next
        }
        if (prev.kind === 'row' && next.kind === 'row') {
          return prev.index === next.index && prev.segKey === next.segKey
            ? prev
            : next
        }
        return next
      })
    })
  }

  const handleWrapMouseDownCapture = (e: ReactMouseEvent) => {
    if (!showGridResizers || e.button !== 0) return
    const hit = hitAt(e.clientX, e.clientY, e.altKey)
    if (!hit) return
    if (hit.kind === 'cross') startCrossMove(e)
    else if (hit.kind === 'col')
      startColResize(e, hit.index, hit.spanStart, hit.spanEnd)
    else startRowResize(e, hit.index, hit.spanStart, hit.spanEnd, hit.edge)
  }

  const handleCellMouseDown = (
    e: ReactMouseEvent,
    row: number,
    col: number,
  ) => {
    const editingThis =
      editingCell?.row === row && editingCell?.col === col
    if (editingThis) {
      e.stopPropagation()
      return
    }
    if (editingCell && editRef.current) {
      onCommitEdit(
        editingCell.row,
        editingCell.col,
        editRef.current.innerText,
      )
    }
    e.stopPropagation()
    onSelectCell({ row, col }, e.ctrlKey || e.metaKey)
  }

  const handleCellContextMenu = (
    e: ReactMouseEvent,
    row: number,
    col: number,
  ) => {
    if (element.locked) return
    e.preventDefault()
    e.stopPropagation()
    if (editingCell && editRef.current) {
      onCommitEdit(
        editingCell.row,
        editingCell.col,
        editRef.current.innerText,
      )
    }
    onSelectCell({ row, col }, false)
    setRowMenu({ x: e.clientX, y: e.clientY, row, col })
  }

  const gridCursorClass =
    hoverHit?.kind === 'col'
      ? 'grid-cursor-col'
      : hoverHit?.kind === 'row'
        ? 'grid-cursor-row'
        : hoverHit?.kind === 'cross'
          ? 'grid-cursor-move'
          : ''

  return (
    <div
      ref={wrapRef}
      className={['table-wrap', showGridResizers ? gridCursorClass : '']
        .filter(Boolean)
        .join(' ')}
      title={
        showGridResizers
          ? '拖中间分隔线：邻格对调，外框不变；Alt=改表格总尺寸；Alt+Q=只挪当前小段；拖顶/底边可改外框高'
          : undefined
      }
      onMouseMove={handleWrapMouseMove}
      onMouseLeave={() => setHoverHit(null)}
      onMouseDownCapture={handleWrapMouseDownCapture}
    >
      <div
        ref={tableRef}
        className="table-el table-el-abs"
        style={
          {
            borderColor: layout.borderColor,
            fontFamily: layout.fontFamily,
            '--table-border-width': mmStyle(Math.max(0, layout.borderWidth)),
            '--table-border-color': layout.borderColor,
          } as CSSProperties
        }
      >
        {layout.cells.map((row, r) =>
          row.map((cell, c) => {
            if (!cell || cell.covered) return null
            const box = getCellBox(layout, r, c)
            if (!box) return null
            const editing =
              editingCell?.row === r && editingCell?.col === c
            const bw = Math.max(0, layout.borderWidth)
            const bc = layout.borderColor
            const bwCss = mmStyle(bw)
            // 只画右/下边（外缘补左/上），避免相邻格双边叠加在 T 字口出现断线毛刺
            const eps = 0.02
            const atLeft = box.x <= eps
            const atTop = box.y <= eps
            const style: CSSProperties = {
              position: 'absolute',
              left: `${(box.x / totalW) * 100}%`,
              top: `${(box.y / totalH) * 100}%`,
              width: `${(box.w / totalW) * 100}%`,
              height: `${(box.h / totalH) * 100}%`,
              // 四边都写明确 px，避免 html2canvas 丢 0 宽边或只认 borderWidth
              borderTop: atTop ? `${bwCss} solid ${bc}` : `0px solid ${bc}`,
              borderRight: `${bwCss} solid ${bc}`,
              borderBottom: `${bwCss} solid ${bc}`,
              borderLeft: atLeft ? `${bwCss} solid ${bc}` : `0px solid ${bc}`,
              backgroundColor:
                cell.backgroundColor === 'transparent'
                  ? undefined
                  : cell.backgroundColor,
              color: cell.color,
              fontFamily: cell.fontFamily ?? layout.fontFamily,
              fontSize: ptStyle(cell.fontSize),
              textDecoration: cell.textDecoration ?? 'none',
              padding: 0,
              boxSizing: 'border-box',
              zIndex: editing ? 2 : 1,
              // 单元格容器不加 skew，避免边框跟着斜
              ...textEmphasisStyle(cell.fontWeight, cell.fontStyle, {
                skew: false,
              }),
            }
            const innerStyle: CSSProperties = {
              display: 'flex',
              width: '100%',
              height: '100%',
              minHeight: '100%',
              boxSizing: 'border-box',
              padding: '1px 2px',
              ...flexAlign(cell),
            }
            const textStyle: CSSProperties = {
              textAlign: cell.textAlign,
              width: '100%',
              textDecoration: cell.textDecoration ?? 'none',
              color: cell.color,
              ...textEmphasisStyle(cell.fontWeight, cell.fontStyle, {
                skew: true,
              }),
            }
            return (
              <div
                key={`${r}-${c}`}
                data-row={r}
                data-col={c}
                className={[
                  'table-cell',
                  selected && isSelected(r, c) ? 'selected-cell' : '',
                  editing ? 'editing' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={style}
                onMouseDown={(e) => handleCellMouseDown(e, r, c)}
                onContextMenu={(e) => handleCellContextMenu(e, r, c)}
                onDoubleClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onStartEdit({ row: r, col: c })
                }}
              >
                <div className="cell-inner" style={innerStyle}>
                  {editing ? (
                    <div
                      ref={editRef}
                      contentEditable
                      suppressContentEditableWarning
                      className={[
                        'cell-text',
                        'cell-edit',
                        textEmphasisClassName(cell.fontWeight, cell.fontStyle),
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={{
                        ...textStyle,
                        outline: 'none',
                        minHeight: '1em',
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onInput={(e) =>
                        onEditInput(e.currentTarget.innerText)
                      }
                      onBlur={(e) => {
                        onCommitEdit(r, c, e.currentTarget.innerText)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          onCancelEdit()
                        }
                        e.stopPropagation()
                      }}
                    />
                  ) : (
                    <span
                      className={[
                        'cell-text',
                        textEmphasisClassName(cell.fontWeight, cell.fontStyle),
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      style={textStyle}
                    >
                      {cell.content}
                    </span>
                  )}
                </div>
              </div>
            )
          }),
        )}
      </div>

      {showGridResizers && (
        <div className="table-grid-resizers" aria-hidden>
          {colSegments.map((seg) => {
            const key = makeSegKey(seg)
            const hot =
              hoverHit?.kind === 'col' &&
              hoverHit.index === seg.index &&
              hoverHit.segKey === key
            return (
              <div
                key={`col-${key}`}
                className={['table-col-resizer', hot ? 'is-hot' : '']
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${seg.posPct}%`,
                  top: `${seg.startPct}%`,
                  bottom: 'auto',
                  height: `${Math.max(0, seg.endPct - seg.startPct)}%`,
                }}
              />
            )
          })}
          {rowSegmentsVisual.map((seg) => {
            const key = makeSegKey(seg)
            const hot =
              hoverHit?.kind === 'row' &&
              hoverHit.index === seg.index &&
              hoverHit.segKey === key
            return (
              <div
                key={`row-${key}`}
                className={['table-row-resizer', hot ? 'is-hot' : '']
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  top: `${seg.posPct}%`,
                  left: `${seg.startPct}%`,
                  right: 'auto',
                  width: `${Math.max(0, seg.endPct - seg.startPct)}%`,
                }}
              />
            )
          })}
          {gridCrosses.map(({ colIndex, rowIndex, leftPct, topPct }) => (
            <div
              key={`cross-${colIndex}-${rowIndex}-${leftPct.toFixed(2)}-${topPct.toFixed(2)}`}
              className={[
                'table-grid-cross',
                hoverHit?.kind === 'cross' &&
                hoverHit.colIndex === colIndex &&
                hoverHit.rowIndex === rowIndex
                  ? 'is-hot'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
            />
          ))}
        </div>
      )}

      <TableRowContextMenu
        open={rowMenu}
        currentRows={element.rows}
        currentCols={element.cols}
        onClose={() => setRowMenu(null)}
        onInsertRows={(row, count, where) => {
          onInsertRows(row, count, where)
          setRowMenu(null)
        }}
        onInsertCols={(col, count, where) => {
          onInsertCols(col, count, where)
          setRowMenu(null)
        }}
        onDeleteRows={(row, count) => {
          onDeleteRows(row, count)
          setRowMenu(null)
        }}
        onDeleteCols={(col, count) => {
          onDeleteCols(col, count)
          setRowMenu(null)
        }}
      />
    </div>
  )
})

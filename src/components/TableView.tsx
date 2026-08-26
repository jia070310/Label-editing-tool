import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import type { CellPos, TableCell, TableElement as TableEl } from '../types'
import { MM_TO_PX, mmStyle, ptStyle } from '../utils/dpi'
import {
  isColBoundaryVisible,
  isRowBoundaryVisible,
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
  | { kind: 'col'; index: number; startX: number; startWidth: number }
  | { kind: 'row'; index: number; startY: number; startHeight: number }

type GridHit =
  | { kind: 'cross'; colIndex: number; rowIndex: number }
  | { kind: 'col'; index: number; segKey: string }
  | { kind: 'row'; index: number; segKey: string }

type MeasuredBands = {
  colPosPct: number[]
  rowPosPct: number[]
  colBandPct: { start: number; end: number }[]
  rowBandPct: { start: number; end: number }[]
}

function makeSegKey(seg: GridLineSegment) {
  return `${seg.index}:${seg.startPct.toFixed(3)}:${seg.endPct.toFixed(3)}`
}

function avg(sum: number, n: number, fallback: number) {
  return n > 0 ? sum / n : fallback
}

/** 用真实渲染后的单元格边框测量网格，保证高亮与黑线重合 */
function measureTableBands(
  wrap: HTMLElement,
  table: HTMLTableElement,
  el: TableEl,
): MeasuredBands | null {
  const wrapRect = wrap.getBoundingClientRect()
  const W = wrapRect.width
  const H = wrapRect.height
  if (W < 1 || H < 1) return null

  const colEdge = Array.from({ length: el.cols + 1 }, () => ({ sum: 0, n: 0 }))
  const rowEdge = Array.from({ length: el.rows + 1 }, () => ({ sum: 0, n: 0 }))

  const tableRect = table.getBoundingClientRect()
  colEdge[0] = { sum: tableRect.left - wrapRect.left, n: 1 }
  colEdge[el.cols] = { sum: tableRect.right - wrapRect.left, n: 1 }
  rowEdge[0] = { sum: tableRect.top - wrapRect.top, n: 1 }
  rowEdge[el.rows] = { sum: tableRect.bottom - wrapRect.top, n: 1 }

  table.querySelectorAll<HTMLTableCellElement>('td[data-row][data-col]').forEach((td) => {
    const r = Number(td.dataset.row)
    const c = Number(td.dataset.col)
    const cell = el.cells[r]?.[c]
    if (!cell || cell.covered) return
    const rect = td.getBoundingClientRect()
    const cs = getComputedStyle(td)
    const bwL = parseFloat(cs.borderLeftWidth) || 0
    const bwR = parseFloat(cs.borderRightWidth) || 0
    const bwT = parseFloat(cs.borderTopWidth) || 0
    const bwB = parseFloat(cs.borderBottomWidth) || 0
    // 贴合可见黑线中心（边框画在 border-box 内侧）
    const left = rect.left - wrapRect.left + bwL / 2
    const right = rect.right - wrapRect.left - bwR / 2
    const top = rect.top - wrapRect.top + bwT / 2
    const bottom = rect.bottom - wrapRect.top - bwB / 2
    const cEnd = Math.min(el.cols, c + Math.max(1, cell.colspan))
    const rEnd = Math.min(el.rows, r + Math.max(1, cell.rowspan))

    colEdge[c].sum += left
    colEdge[c].n++
    colEdge[cEnd].sum += right
    colEdge[cEnd].n++
    rowEdge[r].sum += top
    rowEdge[r].n++
    rowEdge[rEnd].sum += bottom
    rowEdge[rEnd].n++
  })

  const colEdges = colEdge.map((e, i) =>
    avg(e.sum, e.n, (i / el.cols) * W),
  )
  const rowEdges = rowEdge.map((e, i) =>
    avg(e.sum, e.n, (i / el.rows) * H),
  )

  return {
    colPosPct: Array.from({ length: el.cols - 1 }, (_, i) =>
      (colEdges[i + 1] / W) * 100,
    ),
    rowPosPct: Array.from({ length: el.rows - 1 }, (_, i) =>
      (rowEdges[i + 1] / H) * 100,
    ),
    colBandPct: Array.from({ length: el.cols }, (_, i) => ({
      start: (colEdges[i] / W) * 100,
      end: (colEdges[i + 1] / W) * 100,
    })),
    rowBandPct: Array.from({ length: el.rows }, (_, i) => ({
      start: (rowEdges[i] / H) * 100,
      end: (rowEdges[i + 1] / H) * 100,
    })),
  }
}

function buildColSegmentsFromMeasure(
  el: TableEl,
  measured: MeasuredBands,
): GridLineSegment[] {
  const segments: GridLineSegment[] = []
  for (let ci = 0; ci < el.cols - 1; ci++) {
    let runStart = -1
    for (let ri = 0; ri <= el.rows; ri++) {
      const visible = ri < el.rows && isColBoundaryVisible(el, ci, ri)
      if (visible && runStart < 0) runStart = ri
      if (!visible && runStart >= 0) {
        segments.push({
          index: ci,
          posPct: measured.colPosPct[ci],
          startPct: measured.rowBandPct[runStart].start,
          endPct: measured.rowBandPct[ri - 1].end,
        })
        runStart = -1
      }
    }
  }
  return segments
}

function buildRowSegmentsFromMeasure(
  el: TableEl,
  measured: MeasuredBands,
): GridLineSegment[] {
  const segments: GridLineSegment[] = []
  for (let ri = 0; ri < el.rows - 1; ri++) {
    let runStart = -1
    for (let ci = 0; ci <= el.cols; ci++) {
      const visible = ci < el.cols && isRowBoundaryVisible(el, ri, ci)
      if (visible && runStart < 0) runStart = ci
      if (!visible && runStart >= 0) {
        segments.push({
          index: ri,
          posPct: measured.rowPosPct[ri],
          startPct: measured.colBandPct[runStart].start,
          endPct: measured.colBandPct[ci - 1].end,
        })
        runStart = -1
      }
    }
  }
  return segments
}

/** 仅命中实际可见表格线（合并格内部的假线不命中） */
function findGridHit(
  wrap: HTMLElement,
  clientX: number,
  clientY: number,
  colSegments: GridLineSegment[],
  rowSegments: GridLineSegment[],
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
    if (d <= hitSlop && x >= x0 - hitSlop && x <= x1 + hitSlop) {
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
  if (bestCross) {
    return {
      kind: 'cross',
      colIndex: bestCross.colIndex,
      rowIndex: bestCross.rowIndex,
    }
  }

  nearCol.sort((a, b) => a.d - b.d)
  nearRow.sort((a, b) => a.d - b.d)
  if (nearCol[0] && nearRow[0]) {
    if (nearCol[0].d <= nearRow[0].d) {
      return {
        kind: 'col',
        index: nearCol[0].seg.index,
        segKey: makeSegKey(nearCol[0].seg),
      }
    }
    return {
      kind: 'row',
      index: nearRow[0].seg.index,
      segKey: makeSegKey(nearRow[0].seg),
    }
  }
  if (nearCol[0]) {
    return {
      kind: 'col',
      index: nearCol[0].seg.index,
      segKey: makeSegKey(nearCol[0].seg),
    }
  }
  if (nearRow[0]) {
    return {
      kind: 'row',
      index: nearRow[0].seg.index,
      segKey: makeSegKey(nearRow[0].seg),
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
  onTableMoveStart,
  onInsertRows,
  onInsertCols,
  onDeleteRows,
  onDeleteCols,
}: Props) {
  const editRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const tableRef = useRef<HTMLTableElement>(null)
  const gridDragRef = useRef<GridDrag | null>(null)
  const [hoverHit, setHoverHit] = useState<GridHit | null>(null)
  const [colSegments, setColSegments] = useState<GridLineSegment[]>([])
  const [rowSegments, setRowSegments] = useState<GridLineSegment[]>([])
  const [rowMenu, setRowMenu] = useState<{
    x: number
    y: number
    row: number
    col: number
  } | null>(null)

  const totalW = useMemo(
    () => element.colWidths.reduce((a, b) => a + b, 0) || 1,
    [element.colWidths],
  )
  const totalH = useMemo(
    () => element.rowHeights.reduce((a, b) => a + b, 0) || 1,
    [element.rowHeights],
  )

  const showGridResizers =
    selected && !element.locked && !editingCell

  // 按真实 DOM 边框测量网格，避免合并/边框导致高亮错位
  useLayoutEffect(() => {
    if (!showGridResizers) {
      setColSegments([])
      setRowSegments([])
      return
    }
    const wrap = wrapRef.current
    const table = tableRef.current
    if (!wrap || !table) return

    const remeasure = () => {
      const measured = measureTableBands(wrap, table, element)
      if (!measured) return
      setColSegments(buildColSegmentsFromMeasure(element, measured))
      setRowSegments(buildRowSegmentsFromMeasure(element, measured))
    }

    remeasure()
    const ro = new ResizeObserver(() => remeasure())
    ro.observe(wrap)
    ro.observe(table)
    return () => ro.disconnect()
  }, [
    showGridResizers,
    element,
    element.rows,
    element.cols,
    element.rowHeights,
    element.colWidths,
    element.borderWidth,
    element.cells,
    zoom,
  ])

  const gridCrosses = useMemo(() => {
    const crosses: {
      colIndex: number
      rowIndex: number
      leftPct: number
      topPct: number
    }[] = []
    for (const c of colSegments) {
      for (const r of rowSegments) {
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
      const k = `${x.colIndex}-${x.rowIndex}-${x.leftPct.toFixed(2)}-${x.topPct.toFixed(2)}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [colSegments, rowSegments])

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
          onGridResizeCol(
            current.index,
            Math.max(4, Math.round((current.startWidth + dx) * 100) / 100),
          )
        } else {
          const dy = (clientY - current.startY) / scale
          onGridResizeRow(
            current.index,
            Math.max(2, Math.round((current.startHeight + dy) * 100) / 100),
          )
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
      )
    }
  }, [zoom, onGridResizeCol, onGridResizeRow])

  const isSelected = (r: number, c: number) =>
    selectedCells.some((p) => p.row === r && p.col === c)

  const beginGridDrag = (cursorClass: string) => {
    onGridResizeStart()
    document.body.classList.add('table-grid-resizing', cursorClass)
  }

  const startColResize = (e: ReactMouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    beginGridDrag('table-grid-resizing-col')
    gridDragRef.current = {
      kind: 'col',
      index,
      startX: e.clientX,
      startWidth: element.colWidths[index],
    }
  }

  const startRowResize = (e: ReactMouseEvent, index: number) => {
    e.preventDefault()
    e.stopPropagation()
    beginGridDrag('table-grid-resizing-row')
    gridDragRef.current = {
      kind: 'row',
      index,
      startY: e.clientY,
      startHeight: element.rowHeights[index],
    }
  }

  const startCrossMove = (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onTableMoveStart(e)
  }

  const hitAt = (clientX: number, clientY: number) => {
    if (!wrapRef.current || !showGridResizers) return null
    return findGridHit(
      wrapRef.current,
      clientX,
      clientY,
      colSegments,
      rowSegments,
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
    const hit = hitAt(e.clientX, e.clientY)
    if (!hit) return
    if (hit.kind === 'cross') startCrossMove(e)
    else if (hit.kind === 'col') startColResize(e, hit.index)
    else startRowResize(e, hit.index)
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
      onMouseMove={handleWrapMouseMove}
      onMouseLeave={() => setHoverHit(null)}
      onMouseDownCapture={handleWrapMouseDownCapture}
    >
      <table
        ref={tableRef}
        className="table-el"
        style={
          {
            borderColor: element.borderColor,
            fontFamily: element.fontFamily,
            '--table-border-width': mmStyle(Math.max(0, element.borderWidth)),
            '--table-border-color': element.borderColor,
          } as CSSProperties
        }
      >
        <colgroup>
          {element.colWidths.map((w, i) => (
            <col
              key={i}
              style={{ width: `${(w / totalW) * 100}%` }}
            />
          ))}
        </colgroup>
        <tbody>
          {element.cells.map((row, r) => (
            <tr
              key={r}
              style={{
                height: `${((element.rowHeights[r] ?? 8) / totalH) * 100}%`,
              }}
            >
              {row.map((cell, c) => {
                if (!cell || cell.covered) return null
                const editing =
                  editingCell?.row === r && editingCell?.col === c
                const bw = Math.max(0, element.borderWidth)
                const bc = element.borderColor
                const border = `${mmStyle(bw)} solid ${bc}`
                const style: CSSProperties = {
                  borderTop: r === 0 ? border : undefined,
                  borderLeft: c === 0 ? border : undefined,
                  borderRight: border,
                  borderBottom: border,
                  backgroundColor:
                    cell.backgroundColor === 'transparent'
                      ? undefined
                      : cell.backgroundColor,
                  color: cell.color,
                  fontSize: ptStyle(cell.fontSize),
                  fontWeight: cell.fontWeight,
                  fontStyle: cell.fontStyle ?? 'normal',
                  textDecoration: cell.textDecoration ?? 'none',
                  padding: 0,
                  boxSizing: 'border-box',
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
                  fontWeight: cell.fontWeight,
                  fontStyle: cell.fontStyle ?? 'normal',
                  textDecoration: cell.textDecoration ?? 'none',
                  color: cell.color,
                }
                return (
                  <td
                    key={c}
                    data-row={r}
                    data-col={c}
                    rowSpan={cell.rowspan}
                    colSpan={cell.colspan}
                    className={[
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
                          className="cell-text cell-edit"
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
                        <span className="cell-text" style={textStyle}>
                          {cell.content}
                        </span>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

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
          {rowSegments.map((seg) => {
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

import { v4 as uuid } from 'uuid'
import type {
  LabelElement,
  TableCell,
  TableElement,
  TextElement,
  RectElement,
  LineElement,
  BarcodeElement,
  QrcodeElement,
  CellPos,
} from '../types'

export function createEmptyCell(overrides: Partial<TableCell> = {}): TableCell {
  return {
    content: '',
    rowspan: 1,
    colspan: 1,
    covered: false,
    backgroundColor: 'transparent',
    color: '#111111',
    fontSize: 9,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    textAlign: 'left',
    verticalAlign: 'middle',
    ...overrides,
  }
}

export function createTableCells(rows: number, cols: number): TableCell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => createEmptyCell()),
  )
}

export function createTableElement(x = 5, y = 5): TableElement {
  const rows = 4
  const cols = 2
  const rowHeights = Array.from({ length: rows }, () => 8)
  const colWidths = Array.from({ length: cols }, () => 25)
  const cells = createTableCells(rows, cols)
  cells[0][0] = createEmptyCell({
    content: '',
    colspan: 2,
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 11,
  })
  cells[0][1] = createEmptyCell({ covered: true })

  return {
    id: uuid(),
    type: 'table',
    x,
    y,
    width: colWidths.reduce((a, b) => a + b, 0),
    height: rowHeights.reduce((a, b) => a + b, 0),
    rotation: 0,
    locked: false,
    rows,
    cols,
    rowHeights,
    colWidths,
    borderWidth: 0.2,
    borderColor: '#222222',
    fontFamily: 'SimHei, "Microsoft YaHei", sans-serif',
    cells,
  }
}

/** 将表格缩放至标签内指定区域（可选，非默认） */
export function fitTableToRect(
  el: TableElement,
  x: number,
  y: number,
  width: number,
  height: number,
): TableElement {
  const base = resizeTableBox(el, Math.max(10, width), Math.max(10, height))
  return { ...base, x, y }
}

export function createTextElement(x = 5, y = 5): TextElement {
  return {
    id: uuid(),
    type: 'text',
    x,
    y,
    width: 30,
    height: 8,
    rotation: 0,
    locked: false,
    content: '双击编辑文本',
    fontFamily: 'SimHei, "Microsoft YaHei", sans-serif',
    fontSize: 11,
    fontWeight: 'normal',
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#111111',
    textAlign: 'left',
    letterSpacing: 0,
    lineHeight: 1.2,
  }
}

export function createRectElement(x = 5, y = 5): RectElement {
  return {
    id: uuid(),
    type: 'rect',
    x,
    y,
    width: 20,
    height: 15,
    rotation: 0,
    locked: false,
    fill: 'transparent',
    stroke: '#333333',
    strokeWidth: 0.3,
  }
}

export function createLineElement(x = 5, y = 5): LineElement {
  return {
    id: uuid(),
    type: 'line',
    x,
    y,
    width: 30,
    height: 0.3,
    rotation: 0,
    locked: false,
    stroke: '#333333',
    strokeWidth: 0.3,
  }
}

export function createBarcodeElement(x = 5, y = 5): BarcodeElement {
  return {
    id: uuid(),
    type: 'barcode',
    x,
    y,
    width: 40,
    height: 12,
    rotation: 0,
    locked: false,
    value: '123456789012',
    showText: true,
    format: 'CODE128',
  }
}

export function createQrcodeElement(x = 5, y = 5): QrcodeElement {
  return {
    id: uuid(),
    type: 'qrcode',
    x,
    y,
    width: 18,
    height: 18,
    rotation: 0,
    locked: false,
    value: 'https://example.com',
    errorCorrection: 'M',
  }
}

export const MAX_TABLE_ROWS = 40
export const MAX_TABLE_COLS = 20

export function syncTableSize(el: TableElement): TableElement {
  return {
    ...el,
    width: el.colWidths.reduce((a, b) => a + b, 0),
    height: el.rowHeights.reduce((a, b) => a + b, 0),
  }
}

/** 缩表后修正越界合并单元格，避免渲染崩溃 */
function clampMergedCells(el: TableElement): TableElement {
  const origins: { r: number; c: number; cell: TableCell }[] = []
  for (let r = 0; r < el.rows; r++) {
    for (let c = 0; c < el.cols; c++) {
      const cell = el.cells[r]?.[c]
      if (!cell || cell.covered) continue
      origins.push({
        r,
        c,
        cell: {
          ...cell,
          rowspan: Math.min(Math.max(1, cell.rowspan || 1), el.rows - r),
          colspan: Math.min(Math.max(1, cell.colspan || 1), el.cols - c),
        },
      })
    }
  }
  const cells = createTableCells(el.rows, el.cols)
  for (const { r, c, cell } of origins) {
    cells[r][c] = cell
    for (let rr = r; rr < r + cell.rowspan; rr++) {
      for (let cc = c; cc < c + cell.colspan; cc++) {
        if (rr === r && cc === c) continue
        cells[rr][cc] = createEmptyCell({ covered: true })
      }
    }
  }
  return { ...el, cells }
}

export function setTableRows(el: TableElement, rows: number): TableElement {
  const next = Math.min(MAX_TABLE_ROWS, Math.max(1, Math.floor(rows)))
  let cells = cloneCells(el.cells)
  let rowHeights = [...el.rowHeights]
  const cols = el.cols
  if (next > el.rows) {
    for (let r = el.rows; r < next; r++) {
      cells.push(Array.from({ length: cols }, () => createEmptyCell()))
      rowHeights.push(8)
    }
  } else if (next < el.rows) {
    cells = cells.slice(0, next)
    rowHeights = rowHeights.slice(0, next)
  }
  return clampMergedCells(
    syncTableSize({ ...el, rows: next, cells, rowHeights }),
  )
}

export function setTableCols(el: TableElement, cols: number): TableElement {
  const next = Math.min(MAX_TABLE_COLS, Math.max(1, Math.floor(cols)))
  let cells = cloneCells(el.cells)
  let colWidths = [...el.colWidths]
  if (next > el.cols) {
    cells = cells.map((row) => [
      ...row,
      ...Array.from({ length: next - el.cols }, () => createEmptyCell()),
    ])
    colWidths = [
      ...colWidths,
      ...Array.from({ length: next - el.cols }, () => 20),
    ]
  } else if (next < el.cols) {
    cells = cells.map((row) => row.slice(0, next))
    colWidths = colWidths.slice(0, next)
  }
  return clampMergedCells(
    syncTableSize({ ...el, cols: next, cells, colWidths }),
  )
}

/** 在指定行上方或下方插入若干空行 */
export function insertRows(
  el: TableElement,
  atRow: number,
  count: number,
  where: 'above' | 'below',
): TableElement | null {
  const n = Math.floor(count)
  if (n < 1) return null
  const room = MAX_TABLE_ROWS - el.rows
  if (room <= 0) return null
  const insertCount = Math.min(n, room)
  const row = Math.max(0, Math.min(el.rows - 1, Math.floor(atRow)))
  const insertAt = Math.max(
    0,
    Math.min(el.rows, where === 'above' ? row : row + 1),
  )

  const cells = cloneCells(el.cells)
  const rowHeights = [...el.rowHeights]
  const defaultH = rowHeights[row] ?? 8

  // 跨越插入位置的合并单元格：扩大 rowspan，并记录覆盖列
  const spanningCols = new Set<number>()
  for (let r = 0; r < insertAt; r++) {
    for (let c = 0; c < el.cols; c++) {
      const cell = cells[r][c]
      if (cell.covered) continue
      if (r + cell.rowspan > insertAt) {
        cells[r][c] = { ...cell, rowspan: cell.rowspan + insertCount }
        for (let cc = c; cc < c + cell.colspan; cc++) spanningCols.add(cc)
      }
    }
  }

  const blankRows = Array.from({ length: insertCount }, () =>
    Array.from({ length: el.cols }, (_, c) =>
      createEmptyCell({ covered: spanningCols.has(c) }),
    ),
  )
  const blankHeights = Array.from({ length: insertCount }, () => defaultH)

  return syncTableSize({
    ...el,
    rows: el.rows + insertCount,
    cells: [
      ...cells.slice(0, insertAt),
      ...blankRows,
      ...cells.slice(insertAt),
    ],
    rowHeights: [
      ...rowHeights.slice(0, insertAt),
      ...blankHeights,
      ...rowHeights.slice(insertAt),
    ],
  })
}

/** 在指定列左侧或右侧插入若干空列 */
export function insertCols(
  el: TableElement,
  atCol: number,
  count: number,
  where: 'left' | 'right',
): TableElement | null {
  const n = Math.floor(count)
  if (n < 1) return null
  const room = MAX_TABLE_COLS - el.cols
  if (room <= 0) return null
  const insertCount = Math.min(n, room)
  const col = Math.max(0, Math.min(el.cols - 1, Math.floor(atCol)))
  const insertAt = Math.max(
    0,
    Math.min(el.cols, where === 'left' ? col : col + 1),
  )

  const cells = cloneCells(el.cells)
  const colWidths = [...el.colWidths]
  const defaultW = colWidths[col] ?? 20

  // 跨越插入位置的合并单元格：扩大 colspan，并记录覆盖行
  const spanningRows = new Set<number>()
  for (let r = 0; r < el.rows; r++) {
    for (let c = 0; c < insertAt; c++) {
      const cell = cells[r][c]
      if (cell.covered) continue
      if (c + cell.colspan > insertAt) {
        cells[r][c] = { ...cell, colspan: cell.colspan + insertCount }
        for (let rr = r; rr < r + cell.rowspan; rr++) spanningRows.add(rr)
      }
    }
  }

  const nextCells = cells.map((row, r) => [
    ...row.slice(0, insertAt),
    ...Array.from({ length: insertCount }, () =>
      createEmptyCell({ covered: spanningRows.has(r) }),
    ),
    ...row.slice(insertAt),
  ])
  const blankWidths = Array.from({ length: insertCount }, () => defaultW)

  return syncTableSize({
    ...el,
    cols: el.cols + insertCount,
    cells: nextCells,
    colWidths: [
      ...colWidths.slice(0, insertAt),
      ...blankWidths,
      ...colWidths.slice(insertAt),
    ],
  })
}

/** 从指定行起向下删除若干行（至少保留 1 行） */
export function deleteRows(
  el: TableElement,
  atRow: number,
  count: number,
): TableElement | null {
  if (el.rows <= 1) return null
  const n = Math.floor(count)
  if (n < 1) return null
  const start = Math.max(0, Math.min(el.rows - 1, Math.floor(atRow)))
  const deleteCount = Math.min(n, el.rows - start, el.rows - 1)
  if (deleteCount < 1) return null
  const end = start + deleteCount

  const cells = cloneCells(el.cells)
  for (let r = 0; r < start; r++) {
    for (let c = 0; c < el.cols; c++) {
      const cell = cells[r][c]
      if (cell.covered) continue
      const cellEnd = r + cell.rowspan
      if (cellEnd > start) {
        const overlap = Math.min(cellEnd, end) - start
        cells[r][c] = {
          ...cell,
          rowspan: Math.max(1, cell.rowspan - overlap),
        }
      }
    }
  }

  return clampMergedCells(
    syncTableSize({
      ...el,
      rows: el.rows - deleteCount,
      cells: [...cells.slice(0, start), ...cells.slice(end)],
      rowHeights: [
        ...el.rowHeights.slice(0, start),
        ...el.rowHeights.slice(end),
      ],
    }),
  )
}

/** 从指定列起向右删除若干列（至少保留 1 列） */
export function deleteCols(
  el: TableElement,
  atCol: number,
  count: number,
): TableElement | null {
  if (el.cols <= 1) return null
  const n = Math.floor(count)
  if (n < 1) return null
  const start = Math.max(0, Math.min(el.cols - 1, Math.floor(atCol)))
  const deleteCount = Math.min(n, el.cols - start, el.cols - 1)
  if (deleteCount < 1) return null
  const end = start + deleteCount

  const cells = cloneCells(el.cells)
  for (let r = 0; r < el.rows; r++) {
    for (let c = 0; c < start; c++) {
      const cell = cells[r][c]
      if (cell.covered) continue
      const cellEnd = c + cell.colspan
      if (cellEnd > start) {
        const overlap = Math.min(cellEnd, end) - start
        cells[r][c] = {
          ...cell,
          colspan: Math.max(1, cell.colspan - overlap),
        }
      }
    }
  }

  return clampMergedCells(
    syncTableSize({
      ...el,
      cols: el.cols - deleteCount,
      cells: cells.map((row) => [
        ...row.slice(0, start),
        ...row.slice(end),
      ]),
      colWidths: [
        ...el.colWidths.slice(0, start),
        ...el.colWidths.slice(end),
      ],
    }),
  )
}

export function setRowHeight(
  el: TableElement,
  index: number,
  height: number,
): TableElement {
  const rowHeights = [...el.rowHeights]
  rowHeights[index] = Math.max(2, height)
  return syncTableSize({ ...el, rowHeights })
}

export function setColWidth(
  el: TableElement,
  index: number,
  width: number,
): TableElement {
  const colWidths = [...el.colWidths]
  colWidths[index] = Math.max(4, width)
  return syncTableSize({ ...el, colWidths })
}

/** Scale row/col sizes proportionally when outer box is resized */
export function resizeTableBox(
  el: TableElement,
  width: number,
  height: number,
): TableElement {
  const w = Math.max(10, width)
  const h = Math.max(10, height)
  const oldW = el.colWidths.reduce((a, b) => a + b, 0) || 1
  const oldH = el.rowHeights.reduce((a, b) => a + b, 0) || 1
  const colWidths = el.colWidths.map((c) => Math.max(4, (c / oldW) * w))
  const rowHeights = el.rowHeights.map((r) => Math.max(2, (r / oldH) * h))

  // 把舍入/最小值夹紧造成的误差补到最后一列/行，保证与目标宽高一致
  const sumW = colWidths.reduce((a, b) => a + b, 0)
  const sumH = rowHeights.reduce((a, b) => a + b, 0)
  if (colWidths.length > 0) {
    colWidths[colWidths.length - 1] = Math.max(
      4,
      colWidths[colWidths.length - 1] + (w - sumW),
    )
  }
  if (rowHeights.length > 0) {
    rowHeights[rowHeights.length - 1] = Math.max(
      2,
      rowHeights[rowHeights.length - 1] + (h - sumH),
    )
  }

  return {
    ...el,
    width: colWidths.reduce((a, b) => a + b, 0),
    height: rowHeights.reduce((a, b) => a + b, 0),
    colWidths,
    rowHeights,
  }
}

function cloneCells(cells: TableCell[][]): TableCell[][] {
  return cells.map((row) => row.map((c) => ({ ...c })))
}

export function canMerge(el: TableElement, selected: CellPos[]): boolean {
  if (selected.length < 2) return false
  const rows = selected.map((s) => s.row)
  const cols = selected.map((s) => s.col)
  const minR = Math.min(...rows)
  const maxR = Math.max(...rows)
  const minC = Math.min(...cols)
  const maxC = Math.max(...cols)
  const expected = (maxR - minR + 1) * (maxC - minC + 1)
  if (selected.length !== expected) return false

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = el.cells[r]?.[c]
      if (!cell || cell.covered) return false
      if (cell.rowspan > 1 || cell.colspan > 1) {
        if (r + cell.rowspan - 1 > maxR || c + cell.colspan - 1 > maxC) {
          return false
        }
      }
    }
  }
  return true
}

export function mergeCells(
  el: TableElement,
  selected: CellPos[],
): TableElement | null {
  if (!canMerge(el, selected)) return null
  const rows = selected.map((s) => s.row)
  const cols = selected.map((s) => s.col)
  const minR = Math.min(...rows)
  const maxR = Math.max(...rows)
  const minC = Math.min(...cols)
  const maxC = Math.max(...cols)
  const cells = cloneCells(el.cells)
  const origin = cells[minR][minC]
  const contents: string[] = []

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      const cell = cells[r][c]
      if (!cell.covered && cell.content.trim()) contents.push(cell.content)
      if (r === minR && c === minC) continue
      cells[r][c] = createEmptyCell({ covered: true })
    }
  }

  cells[minR][minC] = {
    ...origin,
    content: contents.join(' ') || origin.content,
    rowspan: maxR - minR + 1,
    colspan: maxC - minC + 1,
    covered: false,
  }

  return { ...el, cells }
}

export function canSplit(el: TableElement, pos: CellPos): boolean {
  const cell = el.cells[pos.row]?.[pos.col]
  if (!cell || cell.covered) return false
  return cell.rowspan > 1 || cell.colspan > 1
}

export function splitCell(
  el: TableElement,
  pos: CellPos,
): TableElement | null {
  if (!canSplit(el, pos)) return null
  const cells = cloneCells(el.cells)
  const cell = cells[pos.row][pos.col]
  const { rowspan, colspan } = cell
  cells[pos.row][pos.col] = { ...cell, rowspan: 1, colspan: 1 }

  for (let r = pos.row; r < pos.row + rowspan; r++) {
    for (let c = pos.col; c < pos.col + colspan; c++) {
      if (r === pos.row && c === pos.col) continue
      cells[r][c] = createEmptyCell()
    }
  }
  return { ...el, cells }
}

export function updateCell(
  el: TableElement,
  row: number,
  col: number,
  patch: Partial<TableCell>,
): TableElement {
  const cells = cloneCells(el.cells)
  cells[row][col] = { ...cells[row][col], ...patch }
  return { ...el, cells }
}

export function updateAllCells(
  el: TableElement,
  patch: Partial<TableCell>,
): TableElement {
  const cells = cloneCells(el.cells)
  for (let r = 0; r < el.rows; r++) {
    for (let c = 0; c < el.cols; c++) {
      if (cells[r][c].covered) continue
      cells[r][c] = { ...cells[r][c], ...patch }
    }
  }
  return { ...el, cells }
}

export function updateCells(
  el: TableElement,
  positions: CellPos[],
  patch: Partial<TableCell>,
): TableElement {
  if (positions.length === 0) return el
  const cells = cloneCells(el.cells)
  for (const { row, col } of positions) {
    const cell = cells[row]?.[col]
    if (!cell || cell.covered) continue
    cells[row][col] = { ...cell, ...patch }
  }
  return { ...el, cells }
}

export function getCellAtPoint(
  el: TableElement,
  localX: number,
  localY: number,
): CellPos | null {
  let y = 0
  for (let r = 0; r < el.rows; r++) {
    let x = 0
    const rh = el.rowHeights[r]
    for (let c = 0; c < el.cols; c++) {
      const cw = el.colWidths[c]
      const cell = el.cells[r][c]
      if (!cell.covered) {
        const w = el.colWidths
          .slice(c, c + cell.colspan)
          .reduce((a, b) => a + b, 0)
        const h = el.rowHeights
          .slice(r, r + cell.rowspan)
          .reduce((a, b) => a + b, 0)
        if (localX >= x && localX < x + w && localY >= y && localY < y + h) {
          return { row: r, col: c }
        }
      }
      x += cw
    }
    y += rh
  }
  return null
}

/** 查找格子所属合并原点（含自身） */
export function findCellOrigin(
  el: TableElement,
  row: number,
  col: number,
): CellPos | null {
  if (row < 0 || col < 0 || row >= el.rows || col >= el.cols) return null
  const cell = el.cells[row]?.[col]
  if (!cell) return null
  if (!cell.covered) return { row, col }
  for (let r = row; r >= 0; r--) {
    for (let c = col; c >= 0; c--) {
      const origin = el.cells[r]?.[c]
      if (!origin || origin.covered) continue
      if (r + origin.rowspan > row && c + origin.colspan > col) {
        return { row: r, col: c }
      }
    }
  }
  return null
}

/** 列分隔线（colIndex 与 colIndex+1 之间）在指定行是否为实际可见边框 */
export function isColBoundaryVisible(
  el: TableElement,
  colIndex: number,
  rowIndex: number,
): boolean {
  if (colIndex < 0 || colIndex >= el.cols - 1) return false
  if (rowIndex < 0 || rowIndex >= el.rows) return false
  const left = findCellOrigin(el, rowIndex, colIndex)
  const right = findCellOrigin(el, rowIndex, colIndex + 1)
  if (!left || !right) return false
  return left.row !== right.row || left.col !== right.col
}

/** 行分隔线（rowIndex 与 rowIndex+1 之间）在指定列是否为实际可见边框 */
export function isRowBoundaryVisible(
  el: TableElement,
  rowIndex: number,
  colIndex: number,
): boolean {
  if (rowIndex < 0 || rowIndex >= el.rows - 1) return false
  if (colIndex < 0 || colIndex >= el.cols) return false
  const top = findCellOrigin(el, rowIndex, colIndex)
  const bottom = findCellOrigin(el, rowIndex + 1, colIndex)
  if (!top || !bottom) return false
  return top.row !== bottom.row || top.col !== bottom.col
}

export type GridLineSegment = {
  index: number
  /** 主轴位置（列线的 left% / 行线的 top%），0-100 */
  posPct: number
  /** 分段起点百分比 */
  startPct: number
  /** 分段终点百分比 */
  endPct: number
}

/** 可见列分隔线段（跳过合并单元格内部） */
export function getVisibleColSegments(
  el: TableElement,
  colBoundaries: number[],
  rowBoundaries: number[],
): GridLineSegment[] {
  const segments: GridLineSegment[] = []
  const rowStarts = [0, ...rowBoundaries.slice(0, -1)]
  for (let ci = 0; ci < el.cols - 1; ci++) {
    let runStart = -1
    for (let ri = 0; ri <= el.rows; ri++) {
      const visible =
        ri < el.rows ? isColBoundaryVisible(el, ci, ri) : false
      if (visible && runStart < 0) runStart = ri
      if (!visible && runStart >= 0) {
        segments.push({
          index: ci,
          posPct: colBoundaries[ci],
          startPct: rowStarts[runStart],
          endPct: rowBoundaries[ri - 1],
        })
        runStart = -1
      }
    }
  }
  return segments
}

/** 可见行分隔线段（跳过合并单元格内部） */
export function getVisibleRowSegments(
  el: TableElement,
  colBoundaries: number[],
  rowBoundaries: number[],
): GridLineSegment[] {
  const segments: GridLineSegment[] = []
  const colStarts = [0, ...colBoundaries.slice(0, -1)]
  for (let ri = 0; ri < el.rows - 1; ri++) {
    let runStart = -1
    for (let ci = 0; ci <= el.cols; ci++) {
      const visible =
        ci < el.cols ? isRowBoundaryVisible(el, ri, ci) : false
      if (visible && runStart < 0) runStart = ci
      if (!visible && runStart >= 0) {
        segments.push({
          index: ri,
          posPct: rowBoundaries[ri],
          startPct: colStarts[runStart],
          endPct: colBoundaries[ci - 1],
        })
        runStart = -1
      }
    }
  }
  return segments
}

export function createDemoLabel(): LabelElement[] {
  const table = createTableElement(2, 8)
  const updated = setTableRows(
    setTableCols(
      {
        ...table,
        borderWidth: 0.15,
        cells: createTableCells(11, 2),
        rowHeights: [6, 7, 7, 7, 7, 14, 7, 7, 7, 7, 8],
        colWidths: [18, 38],
      },
      2,
    ),
    11,
  )

  const demo: TableElement = {
    ...updated,
    cells: (() => {
      const cells = createTableCells(11, 2)
      const set = (
        r: number,
        c: number,
        content: string,
        extra: Partial<TableCell> = {},
      ) => {
        cells[r][c] = createEmptyCell({ content, fontSize: 9, ...extra })
      }
      set(0, 0, 'Version: Warm Home', {
        colspan: 2,
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 10,
      })
      cells[0][1] = createEmptyCell({ covered: true })
      set(1, 0, 'Sheer Curtain', { colspan: 2, textAlign: 'center' })
      cells[1][1] = createEmptyCell({ covered: true })
      set(2, 0, 'Composition', { fontWeight: 'bold' })
      set(2, 1, '100% Polyester')
      set(3, 0, 'Width', { fontWeight: 'bold' })
      set(3, 1, '280 cm')
      set(4, 0, 'Weight', { fontWeight: 'bold' })
      set(4, 1, '45 g/m²')
      set(5, 0, 'Price', {
        fontWeight: 'bold',
        backgroundColor: '#ffe8cc',
        verticalAlign: 'middle',
      })
      set(5, 1, '188 / meter', {
        fontWeight: 'bold',
        backgroundColor: '#ffe8cc',
        fontSize: 12,
        textAlign: 'center',
      })
      set(6, 0, 'Color', { fontWeight: 'bold' })
      set(6, 1, 'Ivory')
      set(7, 0, 'Care', { fontWeight: 'bold' })
      set(7, 1, 'Machine wash 30°C')
      set(8, 0, 'Origin', { fontWeight: 'bold' })
      set(8, 1, 'China')
      set(9, 0, 'SKU', { fontWeight: 'bold' })
      set(9, 1, 'WH-SC-280')
      set(10, 0, 'Note', { fontWeight: 'bold' })
      set(10, 1, 'Keep away from fire')
      return cells
    })(),
  }

  return [
    createTextElement(2, 2),
    syncTableSize(demo),
  ].map((el, i) => (i === 0 ? { ...el, content: '窗帘吊牌', fontSize: 12, fontWeight: 'bold' as const, width: 56, height: 6 } : el))
}

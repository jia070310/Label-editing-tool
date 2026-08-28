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
    fontFamily: 'SimHei, "Microsoft YaHei", sans-serif',
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
  const rows = DEFAULT_TABLE_ROWS
  const cols = DEFAULT_TABLE_COLS
  const rowHeights = Array.from({ length: rows }, () => DEFAULT_TABLE_ROW_HEIGHT)
  const colWidths = Array.from({ length: cols }, () => DEFAULT_TABLE_COL_WIDTH)
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
    rowColWidths: Array.from({ length: rows }, () => [...colWidths]),
    rowColHeights: Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => DEFAULT_TABLE_ROW_HEIGHT),
    ),
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
  const base = resizeTableBox(el, Math.max(4, width), Math.max(4, height))
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
/** 未缩放时的种子尺寸（与 createTableElement 一致；实际新增会按标签适配） */
export const DEFAULT_TABLE_ROWS = 4
export const DEFAULT_TABLE_COLS = 2
export const DEFAULT_TABLE_ROW_HEIGHT = 8
export const DEFAULT_TABLE_COL_WIDTH = 25

export type TableUnitSize = { rowH: number; colW: number }

function resolveUnitSize(unit?: TableUnitSize): TableUnitSize {
  return {
    rowH: Math.max(2, unit?.rowH ?? DEFAULT_TABLE_ROW_HEIGHT),
    colW: Math.max(4, unit?.colW ?? DEFAULT_TABLE_COL_WIDTH),
  }
}

/** 边界对齐容差（mm）：错位后的线段不视为同一整线 */
const BOUNDARY_ALIGN_EPS = 0.08

/** 每行总宽对齐到同一目标（改末列），保证外框整齐 */
function fitRowWidthsToTarget(
  rowColWidths: number[][],
  targetW: number,
): number[][] {
  const tw = Math.max(4, targetW)
  return rowColWidths.map((row) => {
    if (!row.length) return row
    const next = row.map((w) => Math.max(4, w))
    if (next.length === 1) return [tw]
    const headSum = next.slice(0, -1).reduce((a, b) => a + b, 0)
    next[next.length - 1] = Math.max(4, tw - headSum)
    return next
  })
}

/** 每列总高对齐到同一目标（改末行），保证外框整齐 */
function fitColHeightsToTarget(
  rowColHeights: number[][],
  cols: number,
  targetH: number,
): number[][] {
  const th = Math.max(2, targetH)
  const rows = rowColHeights.length
  if (rows < 1 || cols < 1) return rowColHeights
  const next = rowColHeights.map((row) => row.map((h) => Math.max(2, h)))
  for (let c = 0; c < cols; c++) {
    if (rows === 1) {
      next[0][c] = th
      continue
    }
    let head = 0
    for (let r = 0; r < rows - 1; r++) head += next[r][c] ?? 2
    next[rows - 1][c] = Math.max(2, th - head)
  }
  return next
}

function maxRowWidth(rowColWidths: number[][] | undefined, fallback: number[]): number {
  let max = 0
  if (rowColWidths?.length) {
    for (const row of rowColWidths) {
      max = Math.max(
        max,
        row.reduce((a, b) => a + b, 0),
      )
    }
  }
  if (!(max > 0)) max = fallback.reduce((a, b) => a + b, 0)
  return max || 1
}

function maxColHeight(
  rowColHeights: number[][] | undefined,
  cols: number,
  fallback: number[],
): number {
  let max = 0
  if (rowColHeights?.length && cols > 0) {
    for (let c = 0; c < cols; c++) {
      let h = 0
      for (let r = 0; r < rowColHeights.length; r++) {
        h += rowColHeights[r]?.[c] ?? 0
      }
      max = Math.max(max, h)
    }
  }
  if (!(max > 0)) max = fallback.reduce((a, b) => a + b, 0)
  return max || 1
}

/** 保证每行都有列宽数组，且各行总宽一致（等于表格宽） */
export function ensureRowColWidths(el: TableElement): TableElement {
  const cols = el.cols
  const base =
    el.colWidths.length === cols
      ? el.colWidths
      : Array.from({ length: cols }, (_, i) => el.colWidths[i] ?? 20)
  const rows = el.rows
  let rowColWidths = el.rowColWidths
  const needRebuild =
    !rowColWidths ||
    rowColWidths.length !== rows ||
    rowColWidths.some((r) => !r || r.length !== cols)
  if (needRebuild) {
    rowColWidths = Array.from({ length: rows }, () => [...base])
  } else {
    rowColWidths = rowColWidths!.map((row) =>
      row.map((w) => Math.max(4, w ?? 4)),
    )
  }
  const target =
    el.width > 0
      ? el.width
      : maxRowWidth(rowColWidths, base)
  rowColWidths = fitRowWidthsToTarget(rowColWidths!, target)
  return {
    ...el,
    width: target,
    colWidths: [...(rowColWidths[0] ?? base)],
    rowColWidths,
  }
}

/** 保证 [row][col] 行高矩阵，且各列总高一致（等于表格高） */
export function ensureRowColHeights(el: TableElement): TableElement {
  const rows = el.rows
  const cols = el.cols
  const baseH =
    el.rowHeights.length === rows
      ? el.rowHeights
      : Array.from({ length: rows }, (_, i) => el.rowHeights[i] ?? 8)
  let rowColHeights = el.rowColHeights
  const needRebuild =
    !rowColHeights ||
    rowColHeights.length !== rows ||
    rowColHeights.some((r) => !r || r.length !== cols)
  if (needRebuild) {
    rowColHeights = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, () => Math.max(2, baseH[r] ?? 8)),
    )
  } else {
    rowColHeights = rowColHeights!.map((row) =>
      row.map((h) => Math.max(2, h ?? 8)),
    )
  }
  const target =
    el.height > 0
      ? el.height
      : maxColHeight(rowColHeights, cols, baseH)
  rowColHeights = fitColHeightsToTarget(rowColHeights!, cols, target)
  const rowHeights = Array.from({ length: rows }, (_, r) =>
    Math.max(2, ...(rowColHeights![r] ?? [baseH[r] ?? 8])),
  )
  return {
    ...el,
    height: target,
    rowHeights,
    rowColHeights,
  }
}

/**
 * 合并单元格内几何必须一致：
 * - colspan：各列在同一行的行高相同
 * - rowspan：各行在同一列的列宽相同
 * 均衡时在同行/同列内补偿，避免总宽总高被抬高。
 */
export function alignMergedGeometry(el: TableElement): TableElement {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  let rowColWidths = base.rowColWidths!.map((r) => [...r])
  let rowColHeights = base.rowColHeights!.map((r) => [...r])

  for (let r = 0; r < base.rows; r++) {
    for (let c = 0; c < base.cols; c++) {
      const cell = base.cells[r]?.[c]
      if (!cell || cell.covered) continue
      const rs = Math.max(1, cell.rowspan)
      const cs = Math.max(1, cell.colspan)

      if (cs > 1) {
        for (let rr = r; rr < r + rs && rr < base.rows; rr++) {
          let sum = 0
          let n = 0
          for (let cc = c; cc < c + cs && cc < base.cols; cc++) {
            sum += rowColHeights[rr][cc] ?? 2
            n++
          }
          if (n < 1) continue
          const avg = Math.max(2, sum / n)
          for (let cc = c; cc < c + cs && cc < base.cols; cc++) {
            const delta = avg - (rowColHeights[rr][cc] ?? 2)
            rowColHeights[rr][cc] = avg
            // 同列其他行补偿，优先末行
            if (Math.abs(delta) < 1e-6) continue
            const compRow =
              rr === base.rows - 1 ? Math.max(0, base.rows - 2) : base.rows - 1
            if (compRow === rr || compRow < 0) continue
            // 仅当补偿行不在本次 colspan 行段内时才补，避免互相拉扯
            if (compRow >= r && compRow < r + rs) continue
            rowColHeights[compRow][cc] = Math.max(
              2,
              (rowColHeights[compRow][cc] ?? 2) - delta,
            )
          }
        }
      }

      if (rs > 1) {
        for (let cc = c; cc < c + cs && cc < base.cols; cc++) {
          let sum = 0
          let n = 0
          for (let rr = r; rr < r + rs && rr < base.rows; rr++) {
            sum += rowColWidths[rr][cc] ?? 4
            n++
          }
          if (n < 1) continue
          const avg = Math.max(4, sum / n)
          for (let rr = r; rr < r + rs && rr < base.rows; rr++) {
            const old = rowColWidths[rr][cc] ?? 4
            const delta = avg - old
            rowColWidths[rr][cc] = avg
            if (Math.abs(delta) < 1e-6) continue
            // 同行其他列补偿，优先末列且不在本次 colspan 内
            let compCol = -1
            for (let k = base.cols - 1; k >= 0; k--) {
              if (k >= c && k < c + cs) continue
              compCol = k
              break
            }
            if (compCol < 0) continue
            rowColWidths[rr][compCol] = Math.max(
              4,
              (rowColWidths[rr][compCol] ?? 4) - delta,
            )
          }
        }
      }
    }
  }

  // 合并均衡后强制各行总宽、各列总高一致，避免外框参差
  const targetW = base.width > 0 ? base.width : maxRowWidth(rowColWidths, base.colWidths)
  const targetH =
    base.height > 0
      ? base.height
      : maxColHeight(rowColHeights, base.cols, base.rowHeights)
  rowColWidths = fitRowWidthsToTarget(rowColWidths, targetW)
  rowColHeights = fitColHeightsToTarget(rowColHeights, base.cols, targetH)

  const rowHeights = Array.from({ length: base.rows }, (_, r) =>
    Math.max(2, ...rowColHeights[r]),
  )
  return {
    ...base,
    width: targetW,
    height: targetH,
    rowHeights,
    rowColWidths,
    rowColHeights,
    colWidths: [...rowColWidths[0]],
  }
}

function tableContentWidth(el: TableElement): number {
  const rows = el.rowColWidths
  if (!rows?.length) return el.colWidths.reduce((a, b) => a + b, 0)
  let max = 0
  for (const row of rows) {
    max = Math.max(
      max,
      row.reduce((a, b) => a + b, 0),
    )
  }
  return max || el.colWidths.reduce((a, b) => a + b, 0)
}

function tableContentHeight(el: TableElement): number {
  if (!el.rowColHeights?.length) {
    return el.rowHeights.reduce((a, b) => a + b, 0)
  }
  let max = 0
  for (let c = 0; c < el.cols; c++) {
    let colH = 0
    for (let r = 0; r < el.rows; r++) {
      colH += el.rowColHeights![r]?.[c] ?? el.rowHeights[r] ?? 0
    }
    max = Math.max(max, colH)
  }
  return max || el.rowHeights.reduce((a, b) => a + b, 0)
}

export function syncTableSize(el: TableElement): TableElement {
  const normalized = alignMergedGeometry(
    ensureRowColHeights(ensureRowColWidths(el)),
  )
  // 优先保留调用方锁定的宽高；仅在未设置时用内容尺寸
  const width =
    el.width > 0 ? el.width : tableContentWidth(normalized)
  const height =
    el.height > 0 ? el.height : tableContentHeight(normalized)
  return {
    ...normalized,
    width,
    height,
  }
}

export function getRowColWidths(el: TableElement, row: number): number[] {
  const n = ensureRowColWidths(el)
  return n.rowColWidths![Math.min(Math.max(0, row), n.rows - 1)] ?? n.colWidths
}

function heightAt(el: TableElement, row: number, col: number): number {
  const base = ensureRowColHeights(el)
  return base.rowColHeights![row]?.[col] ?? base.rowHeights[row] ?? 8
}

function colStackY(
  el: TableElement,
  col: number,
  rowEndExclusive: number,
): number {
  let y = 0
  for (let r = 0; r < rowEndExclusive; r++) y += heightAt(el, r, col)
  return y
}

/** 原点单元格在表格内的毫米包围盒（支持每行不同列宽、每列不同行高） */
export function getCellBox(
  el: TableElement,
  row: number,
  col: number,
): { x: number; y: number; w: number; h: number } | null {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const cell = base.cells[row]?.[col]
  if (!cell || cell.covered) return null
  const widths = getRowColWidths(base, row)
  const cs = Math.max(1, cell.colspan)
  const rs = Math.max(1, cell.rowspan)
  const x = widths.slice(0, col).reduce((a, b) => a + b, 0)
  const w = widths.slice(col, col + cs).reduce((a, b) => a + b, 0)
  const y = colStackY(base, col, row)
  let h = 0
  for (let r = row; r < row + rs; r++) h += heightAt(base, r, col)
  return { x, y, w, h }
}

/** 按布局生成列分隔线段：同 X 连续可见行合并为一段 */
export function buildColSegmentsLayout(el: TableElement): GridLineSegment[] {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const totalH = base.height || base.rowHeights.reduce((a, b) => a + b, 0) || 1
  const totalW =
    base.rowColWidths![0]?.reduce((a, b) => a + b, 0) ||
    base.colWidths.reduce((a, b) => a + b, 0) ||
    1
  const segments: GridLineSegment[] = []
  for (let ci = 0; ci < base.cols - 1; ci++) {
    let ri = 0
    while (ri < base.rows) {
      if (!isColBoundaryVisible(base, ci, ri)) {
        ri++
        continue
      }
      const targetX = colBoundaryX(base, ri, ci)
      const runStart = ri
      ri++
      while (ri < base.rows) {
        if (!isColBoundaryVisible(base, ci, ri)) break
        const x = colBoundaryX(base, ri, ci)
        if (Math.abs(x - targetX) > BOUNDARY_ALIGN_EPS) break
        ri++
      }
      const y0 = Math.max(
        colStackY(base, ci, runStart),
        colStackY(base, ci + 1, runStart),
      )
      const y1 = Math.min(
        colStackY(base, ci, ri),
        colStackY(base, ci + 1, ri),
      )
      if (y1 - y0 < 0.2) continue
      segments.push({
        index: ci,
        posPct: (targetX / totalW) * 100,
        startPct: (y0 / totalH) * 100,
        endPct: (y1 / totalH) * 100,
        spanStart: runStart,
        spanEnd: ri,
      })
    }
  }
  return segments
}

/** 按布局生成行分隔线段：同 Y 连续可见列合并为一段 */
export function buildRowSegmentsLayout(el: TableElement): GridLineSegment[] {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const totalH = base.height || base.rowHeights.reduce((a, b) => a + b, 0) || 1
  const totalW =
    base.rowColWidths![0]?.reduce((a, b) => a + b, 0) ||
    base.colWidths.reduce((a, b) => a + b, 0) ||
    1
  const segments: GridLineSegment[] = []
  for (let ri = 0; ri < base.rows - 1; ri++) {
    let ci = 0
    while (ci < base.cols) {
      if (!isRowBoundaryVisible(base, ri, ci)) {
        ci++
        continue
      }
      const targetY = rowBoundaryY(base, ci, ri)
      const runStart = ci
      ci++
      while (ci < base.cols) {
        if (!isRowBoundaryVisible(base, ri, ci)) break
        const y = rowBoundaryY(base, ci, ri)
        if (Math.abs(y - targetY) > BOUNDARY_ALIGN_EPS) break
        ci++
      }
      // 横向跨度：相邻行在该列范围上的宽度并集近似（用上侧行宽）
      const widths = getRowColWidths(base, ri)
      const x0 = widths.slice(0, runStart).reduce((a, b) => a + b, 0)
      const x1 = widths.slice(0, ci).reduce((a, b) => a + b, 0)
      if (x1 - x0 < 0.2) continue
      segments.push({
        index: ri,
        posPct: (targetY / totalH) * 100,
        startPct: (x0 / totalW) * 100,
        endPct: (x1 / totalW) * 100,
        spanStart: runStart,
        spanEnd: ci,
      })
    }
  }
  segments.push({
    index: 0,
    edge: 'top',
    posPct: 0,
    startPct: 0,
    endPct: 100,
    spanStart: 0,
    spanEnd: base.cols,
  })
  segments.push({
    index: base.rows - 1,
    edge: 'bottom',
    posPct: 100,
    startPct: 0,
    endPct: 100,
    spanStart: 0,
    spanEnd: base.cols,
  })
  return segments
}

/** 竖线某段内，指针 Y（mm）落在哪一行 */
export function findRowAtColBoundaryY(
  el: TableElement,
  leftIndex: number,
  spanStart: number,
  spanEnd: number,
  yMm: number,
): number {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const r0 = Math.max(0, Math.min(base.rows, Math.floor(spanStart)))
  const r1 = Math.max(r0 + 1, Math.min(base.rows, Math.floor(spanEnd)))
  for (let r = r0; r < r1; r++) {
    const y0 = Math.max(
      colStackY(base, leftIndex, r),
      colStackY(base, leftIndex + 1, r),
    )
    const y1 = Math.min(
      colStackY(base, leftIndex, r + 1),
      colStackY(base, leftIndex + 1, r + 1),
    )
    if (yMm >= y0 - 0.05 && yMm <= y1 + 0.05) return r
  }
  // 落在段外时取最近行
  let best = r0
  let bestD = Infinity
  for (let r = r0; r < r1; r++) {
    const mid =
      (Math.max(colStackY(base, leftIndex, r), colStackY(base, leftIndex + 1, r)) +
        Math.min(
          colStackY(base, leftIndex, r + 1),
          colStackY(base, leftIndex + 1, r + 1),
        )) /
      2
    const d = Math.abs(yMm - mid)
    if (d < bestD) {
      bestD = d
      best = r
    }
  }
  return best
}

/** 横线某段内，指针 X（mm）落在哪一列 */
export function findColAtRowBoundaryX(
  el: TableElement,
  topIndex: number,
  spanStart: number,
  spanEnd: number,
  xMm: number,
): number {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const c0 = Math.max(0, Math.min(base.cols, Math.floor(spanStart)))
  const c1 = Math.max(c0 + 1, Math.min(base.cols, Math.floor(spanEnd)))
  const widths = getRowColWidths(base, topIndex)
  let x = widths.slice(0, c0).reduce((a, b) => a + b, 0)
  for (let c = c0; c < c1; c++) {
    const w = widths[c] ?? 4
    if (xMm >= x - 0.05 && xMm <= x + w + 0.05) return c
    x += w
  }
  let best = c0
  let bestD = Infinity
  let acc = widths.slice(0, c0).reduce((a, b) => a + b, 0)
  for (let c = c0; c < c1; c++) {
    const w = widths[c] ?? 4
    const mid = acc + w / 2
    const d = Math.abs(xMm - mid)
    if (d < bestD) {
      bestD = d
      best = c
    }
    acc += w
  }
  return best
}

/** Boundary X after leftIndex in a row (sum of widths[0..leftIndex]) */
export function colBoundaryX(
  el: TableElement,
  row: number,
  leftIndex: number,
): number {
  const widths = getRowColWidths(el, row)
  return widths
    .slice(0, Math.max(0, leftIndex + 1))
    .reduce((a, b) => a + b, 0)
}

/** Boundary Y after topIndex in a column (sum of heights[0..topIndex] in that col) */
export function rowBoundaryY(
  el: TableElement,
  col: number,
  topIndex: number,
): number {
  return colStackY(el, col, Math.max(0, topIndex + 1))
}

/** 因 rowspan 合并，竖线拖动时扩大行范围，避免合并格内列宽不一致 */
function expandRowRangeForColBoundary(
  el: TableElement,
  leftIndex: number,
  rowStart: number,
  rowEndExclusive: number,
): [number, number] {
  let r0 = rowStart
  let r1 = rowEndExclusive
  let changed = true
  while (changed) {
    changed = false
    for (let r = 0; r < el.rows; r++) {
      for (let c = 0; c < el.cols; c++) {
        const cell = el.cells[r]?.[c]
        if (!cell || cell.covered) continue
        const rs = Math.max(1, cell.rowspan)
        const cs = Math.max(1, cell.colspan)
        if (rs <= 1) continue
        const coversLeft = c <= leftIndex && c + cs > leftIndex
        const coversRight = c <= leftIndex + 1 && c + cs > leftIndex + 1
        if (!coversLeft && !coversRight) continue
        const mr0 = r
        const mr1 = r + rs
        if (mr1 <= r0 || mr0 >= r1) continue
        if (mr0 < r0 || mr1 > r1) {
          r0 = Math.min(r0, mr0)
          r1 = Math.max(r1, mr1)
          changed = true
        }
      }
    }
  }
  return [r0, r1]
}

/** 因 colspan 合并，横线拖动时扩大列范围，避免合并格内行高不一致 */
function expandColRangeForRowBoundary(
  el: TableElement,
  topIndex: number,
  colStart: number,
  colEndExclusive: number,
): [number, number] {
  let c0 = colStart
  let c1 = colEndExclusive
  const bottomIndex = topIndex + 1
  let changed = true
  while (changed) {
    changed = false
    for (let r = 0; r < el.rows; r++) {
      for (let c = 0; c < el.cols; c++) {
        const cell = el.cells[r]?.[c]
        if (!cell || cell.covered) continue
        const rs = Math.max(1, cell.rowspan)
        const cs = Math.max(1, cell.colspan)
        if (cs <= 1) continue
        const coversTop = r <= topIndex && r + rs > topIndex
        const coversBottom = r <= bottomIndex && r + rs > bottomIndex
        if (!coversTop && !coversBottom) continue
        const mc0 = c
        const mc1 = c + cs
        if (mc1 <= c0 || mc0 >= c1) continue
        if (mc0 < c0 || mc1 > c1) {
          c0 = Math.min(c0, mc0)
          c1 = Math.max(c1, mc1)
          changed = true
        }
      }
    }
  }
  return [c0, c1]
}

/** 从锚点行沿 leftIndex 扩展：可见且边界 X 对齐的连续行 */
export function findAlignedColRowSpan(
  el: TableElement,
  leftIndex: number,
  anchorRow: number,
): { rowStart: number; rowEnd: number } {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const anchor = Math.max(0, Math.min(base.rows - 1, Math.floor(anchorRow)))
  if (leftIndex < 0 || leftIndex >= base.cols - 1) {
    return { rowStart: anchor, rowEnd: anchor + 1 }
  }
  if (!isColBoundaryVisible(base, leftIndex, anchor)) {
    return { rowStart: anchor, rowEnd: anchor + 1 }
  }
  const targetX = colBoundaryX(base, anchor, leftIndex)
  let rowStart = anchor
  let rowEnd = anchor + 1
  while (rowStart > 0) {
    const r = rowStart - 1
    if (!isColBoundaryVisible(base, leftIndex, r)) break
    if (Math.abs(colBoundaryX(base, r, leftIndex) - targetX) > BOUNDARY_ALIGN_EPS)
      break
    rowStart = r
  }
  while (rowEnd < base.rows) {
    if (!isColBoundaryVisible(base, leftIndex, rowEnd)) break
    if (
      Math.abs(colBoundaryX(base, rowEnd, leftIndex) - targetX) >
      BOUNDARY_ALIGN_EPS
    )
      break
    rowEnd++
  }
  ;[rowStart, rowEnd] = expandRowRangeForColBoundary(
    base,
    leftIndex,
    rowStart,
    rowEnd,
  )
  return { rowStart, rowEnd }
}

/** 从锚点列沿 topIndex 扩展：可见且边界 Y 对齐的连续列 */
export function findAlignedRowColSpan(
  el: TableElement,
  topIndex: number,
  anchorCol: number,
): { colStart: number; colEnd: number } {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const anchor = Math.max(0, Math.min(base.cols - 1, Math.floor(anchorCol)))
  if (topIndex < 0 || topIndex >= base.rows - 1) {
    return { colStart: anchor, colEnd: anchor + 1 }
  }
  if (!isRowBoundaryVisible(base, topIndex, anchor)) {
    return { colStart: anchor, colEnd: anchor + 1 }
  }
  const targetY = rowBoundaryY(base, anchor, topIndex)
  let colStart = anchor
  let colEnd = anchor + 1
  while (colStart > 0) {
    const c = colStart - 1
    if (!isRowBoundaryVisible(base, topIndex, c)) break
    if (Math.abs(rowBoundaryY(base, c, topIndex) - targetY) > BOUNDARY_ALIGN_EPS)
      break
    colStart = c
  }
  while (colEnd < base.cols) {
    if (!isRowBoundaryVisible(base, topIndex, colEnd)) break
    if (
      Math.abs(rowBoundaryY(base, colEnd, topIndex) - targetY) >
      BOUNDARY_ALIGN_EPS
    )
      break
    colEnd++
  }
  ;[colStart, colEnd] = expandColRangeForRowBoundary(
    base,
    topIndex,
    colStart,
    colEnd,
  )
  return { colStart, colEnd }
}

/** 仅在指定行范围内成对移动列分隔线（左宽右窄，各行总宽保持为表格宽） */
export function moveColBoundaryInRows(
  el: TableElement,
  leftIndex: number,
  leftWidth: number,
  rowStart: number,
  rowEnd: number,
  expandMerge = true,
): TableElement {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const lockedW = base.width > 0 ? base.width : tableContentWidth(base)
  const lockedH = base.height > 0 ? base.height : tableContentHeight(base)
  const rightIndex = leftIndex + 1
  if (rightIndex >= base.cols || leftIndex < 0) {
    return setColWidth(base, leftIndex, leftWidth)
  }
  let r0 = Math.max(0, Math.min(base.rows, Math.floor(rowStart)))
  let r1 = Math.max(r0, Math.min(base.rows, Math.floor(rowEnd)))
  if (expandMerge) {
    ;[r0, r1] = expandRowRangeForColBoundary(base, leftIndex, r0, r1)
  }
  let rowColWidths = base.rowColWidths!.map((row, ri) => {
    if (ri < r0 || ri >= r1) return [...row]
    const sum = (row[leftIndex] ?? 4) + (row[rightIndex] ?? 4)
    const newLeft = Math.max(4, Math.min(sum - 4, leftWidth))
    const next = [...row]
    next[leftIndex] = newLeft
    next[rightIndex] = Math.max(4, sum - newLeft)
    return next
  })
  rowColWidths = fitRowWidthsToTarget(rowColWidths, lockedW)
  return syncTableSize({
    ...base,
    width: lockedW,
    height: lockedH,
    rowColWidths,
    colWidths: [...rowColWidths[0]],
  })
}

/** 仅在指定列范围内成对移动行分隔线（上高下矮，各列总高保持为表格高） */
export function moveRowBoundaryInCols(
  el: TableElement,
  topIndex: number,
  topHeight: number,
  colStart: number,
  colEnd: number,
  expandMerge = true,
): TableElement {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const lockedW = base.width > 0 ? base.width : tableContentWidth(base)
  const lockedH = base.height > 0 ? base.height : tableContentHeight(base)
  const bottomIndex = topIndex + 1
  if (bottomIndex >= base.rows || topIndex < 0) {
    return setRowHeight(base, topIndex, topHeight)
  }
  let c0 = Math.max(0, Math.min(base.cols, Math.floor(colStart)))
  let c1 = Math.max(c0, Math.min(base.cols, Math.floor(colEnd)))
  if (expandMerge) {
    ;[c0, c1] = expandColRangeForRowBoundary(base, topIndex, c0, c1)
  }
  let rowColHeights = base.rowColHeights!.map((row) => [...row])
  for (let c = c0; c < c1; c++) {
    const sum =
      (rowColHeights[topIndex][c] ?? 2) + (rowColHeights[bottomIndex][c] ?? 2)
    const newTop = Math.max(2, Math.min(sum - 2, topHeight))
    rowColHeights[topIndex][c] = newTop
    rowColHeights[bottomIndex][c] = Math.max(2, sum - newTop)
  }
  rowColHeights = fitColHeightsToTarget(rowColHeights, base.cols, lockedH)
  return syncTableSize({
    ...base,
    width: lockedW,
    height: lockedH,
    rowColHeights,
  })
}

/** 仅在行范围内改列宽；表格总宽随该列变化，其它行末列补齐，外框始终整齐 */
export function resizeColInRows(
  el: TableElement,
  leftIndex: number,
  leftWidth: number,
  rowStart: number,
  rowEnd: number,
): TableElement {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  if (leftIndex < 0 || leftIndex >= base.cols) return base
  let r0 = Math.max(0, Math.min(base.rows, Math.floor(rowStart)))
  let r1 = Math.max(r0, Math.min(base.rows, Math.floor(rowEnd)))
  ;[r0, r1] = expandRowRangeForColBoundary(base, leftIndex, r0, r1)
  const anchor = Math.max(r0, Math.min(r1 - 1, r0))
  const oldLeft = base.rowColWidths![anchor]?.[leftIndex] ?? base.colWidths[leftIndex] ?? 20
  const w = Math.max(4, leftWidth)
  const delta = w - oldLeft
  const oldW = base.width > 0 ? base.width : tableContentWidth(base)
  const newW = Math.max(base.cols * 4, oldW + delta)
  let rowColWidths = base.rowColWidths!.map((row, ri) => {
    if (ri < r0 || ri >= r1) return [...row]
    const next = [...row]
    next[leftIndex] = w
    return next
  })
  rowColWidths = fitRowWidthsToTarget(rowColWidths, newW)
  return syncTableSize({
    ...base,
    width: newW,
    rowColWidths,
    colWidths: [...rowColWidths[0]],
  })
}

/** 仅在列范围内改行高；表格总高随该行变化，其它列末行补齐，外框始终整齐 */
export function resizeRowInCols(
  el: TableElement,
  topIndex: number,
  topHeight: number,
  colStart: number,
  colEnd: number,
): TableElement {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  if (topIndex < 0 || topIndex >= base.rows) return base
  let c0 = Math.max(0, Math.min(base.cols, Math.floor(colStart)))
  let c1 = Math.max(c0, Math.min(base.cols, Math.floor(colEnd)))
  ;[c0, c1] = expandColRangeForRowBoundary(base, topIndex, c0, c1)
  const anchor = Math.max(c0, Math.min(c1 - 1, c0))
  const oldTop =
    base.rowColHeights![topIndex]?.[anchor] ?? base.rowHeights[topIndex] ?? 8
  const h = Math.max(2, topHeight)
  const delta = h - oldTop
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const newH = Math.max(base.rows * 2, oldH + delta)
  let rowColHeights = base.rowColHeights!.map((row) => [...row])
  for (let c = c0; c < c1; c++) {
    rowColHeights[topIndex][c] = h
  }
  rowColHeights = fitColHeightsToTarget(rowColHeights, base.cols, newH)
  return syncTableSize({
    ...base,
    height: newH,
    rowColHeights,
  })
}

/** 从顶边拖动：首行高度变化、总高反向补偿，顶边跟随鼠标（底边保持不动） */
export function resizeRowFromTopEdge(
  el: TableElement,
  newRow0Height: number,
  colStart: number,
  colEnd: number,
): { table: TableElement; deltaY: number } {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const h = Math.max(2, newRow0Height)
  let c0 = Math.max(0, Math.min(base.cols, Math.floor(colStart)))
  let c1 = Math.max(c0, Math.min(base.cols, Math.floor(colEnd)))
  ;[c0, c1] = expandColRangeForRowBoundary(base, 0, c0, c1)
  const anchor = Math.max(c0, Math.min(c1 - 1, c0))
  const oldTop =
    base.rowColHeights![0]?.[anchor] ?? base.rowHeights[0] ?? 8
  const delta = h - oldTop
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const newH = Math.max(base.rows * 2, oldH + delta)
  let rowColHeights = base.rowColHeights!.map((row) => [...row])
  for (let c = c0; c < c1; c++) {
    rowColHeights[0][c] = h
  }
  rowColHeights = fitColHeightsToTarget(rowColHeights, base.cols, newH)
  const table = syncTableSize({
    ...base,
    height: newH,
    rowColHeights,
  })
  return { table, deltaY: -delta }
}

/** 移动列分隔线：所有行（legacy） */
export function moveColBoundary(
  el: TableElement,
  leftIndex: number,
  leftWidth: number,
): TableElement {
  return moveColBoundaryInRows(el, leftIndex, leftWidth, 0, el.rows)
}

/** 移动行分隔线：所有列（legacy） */
export function moveRowBoundary(
  el: TableElement,
  topIndex: number,
  topHeight: number,
): TableElement {
  return moveRowBoundaryInCols(el, topIndex, topHeight, 0, el.cols)
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

function rowSpanHeight(row: number[] | undefined, fallback: number): number {
  if (!row?.length) return Math.max(2, fallback)
  return Math.max(2, ...row.map((h) => Math.max(2, h ?? fallback)))
}

function colSpanWidth(colIndex: number, rows: number[][], fallback: number): number {
  let max = 0
  for (const row of rows) {
    max = Math.max(max, Math.max(4, row[colIndex] ?? fallback))
  }
  return max || Math.max(4, fallback)
}

export function setTableRows(
  el: TableElement,
  rows: number,
  unit?: TableUnitSize,
): TableElement {
  const { rowH: newRowH } = resolveUnitSize(unit)
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const next = Math.min(MAX_TABLE_ROWS, Math.max(1, Math.floor(rows)))
  let cells = cloneCells(base.cells)
  let rowHeights = [...base.rowHeights]
  let rowColWidths = base.rowColWidths!.map((r) => [...r])
  let rowColHeights = base.rowColHeights!.map((r) => [...r])
  const cols = base.cols
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const oldW = base.width > 0 ? base.width : tableContentWidth(base)
  let newH = oldH
  if (next > base.rows) {
    const add = next - base.rows
    const template = [...(rowColWidths[base.rows - 1] ?? base.colWidths)]
    const hTemplate = Array.from({ length: cols }, () => newRowH)
    for (let r = base.rows; r < next; r++) {
      cells.push(Array.from({ length: cols }, () => createEmptyCell()))
      rowHeights.push(newRowH)
      rowColWidths.push([...template])
      rowColHeights.push([...hTemplate])
    }
    // 向外增高：按「当前标签默认表格」的单行高扩展
    newH = oldH + add * newRowH
  } else if (next < base.rows) {
    let removed = 0
    for (let r = next; r < base.rows; r++) {
      removed += rowSpanHeight(rowColHeights[r], rowHeights[r] ?? newRowH)
    }
    newH = Math.max(next * 2, oldH - removed)
    cells = cells.slice(0, next)
    rowHeights = rowHeights.slice(0, next)
    rowColWidths = rowColWidths.slice(0, next)
    rowColHeights = rowColHeights.slice(0, next)
  }
  return clampMergedCells(
    syncTableSize({
      ...base,
      width: oldW,
      height: newH,
      rows: next,
      cells,
      rowHeights,
      rowColWidths,
      rowColHeights,
      colWidths: [...(rowColWidths[0] ?? base.colWidths)],
    }),
  )
}

export function setTableCols(
  el: TableElement,
  cols: number,
  unit?: TableUnitSize,
): TableElement {
  const { rowH: newRowH, colW: newColW } = resolveUnitSize(unit)
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const next = Math.min(MAX_TABLE_COLS, Math.max(1, Math.floor(cols)))
  let cells = cloneCells(base.cells)
  let colWidths = [...base.colWidths]
  let rowColWidths = base.rowColWidths!.map((r) => [...r])
  let rowColHeights = base.rowColHeights!.map((r) => [...r])
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const oldW = base.width > 0 ? base.width : tableContentWidth(base)
  let newW = oldW
  if (next > base.cols) {
    const addN = next - base.cols
    cells = cells.map((row) => [
      ...row,
      ...Array.from({ length: addN }, () => createEmptyCell()),
    ])
    const add = Array.from({ length: addN }, () => newColW)
    colWidths = [...colWidths, ...add]
    rowColWidths = rowColWidths.map((r) => [...r, ...add])
    rowColHeights = rowColHeights.map((rowH, r) => [
      ...rowH,
      ...Array.from({ length: addN }, () =>
        Math.max(2, base.rowHeights[r] ?? newRowH),
      ),
    ])
    // 向外加宽：按「当前标签默认表格」的单列宽扩展
    newW = oldW + addN * newColW
  } else if (next < base.cols) {
    let removed = 0
    for (let c = next; c < base.cols; c++) {
      removed += colSpanWidth(c, rowColWidths, colWidths[c] ?? newColW)
    }
    newW = Math.max(next * 4, oldW - removed)
    cells = cells.map((row) => row.slice(0, next))
    colWidths = colWidths.slice(0, next)
    rowColWidths = rowColWidths.map((r) => r.slice(0, next))
    rowColHeights = rowColHeights.map((r) => r.slice(0, next))
  }
  return clampMergedCells(
    syncTableSize({
      ...base,
      width: newW,
      height: oldH,
      cols: next,
      cells,
      colWidths,
      rowColWidths,
      rowColHeights,
    }),
  )
}

/** 在指定行上方或下方插入若干空行 */
export function insertRows(
  el: TableElement,
  atRow: number,
  count: number,
  where: 'above' | 'below',
  unit?: TableUnitSize,
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
  // 使用当前标签下默认新建表格的单行高
  const { rowH: newRowH } = resolveUnitSize(unit)

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
  const blankHeights = Array.from({ length: insertCount }, () => newRowH)
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const template = [...(base.rowColWidths![row] ?? base.colWidths)]
  const blankRowCols = Array.from({ length: insertCount }, () => [...template])
  const rowColWidths = [
    ...base.rowColWidths!.slice(0, insertAt),
    ...blankRowCols,
    ...base.rowColWidths!.slice(insertAt),
  ]
  const hTemplate = Array.from({ length: el.cols }, () => newRowH)
  const blankRowHeights = Array.from({ length: insertCount }, () => [
    ...hTemplate,
  ])
  const rowColHeights = [
    ...base.rowColHeights!.slice(0, insertAt),
    ...blankRowHeights,
    ...base.rowColHeights!.slice(insertAt),
  ]
  const addH = insertCount * newRowH
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const oldW = base.width > 0 ? base.width : tableContentWidth(base)

  return syncTableSize({
    ...el,
    width: oldW,
    height: oldH + addH,
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
    rowColWidths,
    rowColHeights,
    colWidths: [...(rowColWidths[0] ?? el.colWidths)],
  })
}

/** 在指定列左侧或右侧插入若干空列 */
export function insertCols(
  el: TableElement,
  atCol: number,
  count: number,
  where: 'left' | 'right',
  unit?: TableUnitSize,
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
  // 使用当前标签下默认新建表格的单列宽
  const { rowH: newRowH, colW: newColW } = resolveUnitSize(unit)

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
  const blankWidths = Array.from({ length: insertCount }, () => newColW)
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const rowColWidths = base.rowColWidths!.map((rowWidths) => [
    ...rowWidths.slice(0, insertAt),
    ...blankWidths,
    ...rowWidths.slice(insertAt),
  ])
  const rowColHeights = base.rowColHeights!.map((rowH, r) => [
    ...rowH.slice(0, insertAt),
    ...Array.from({ length: insertCount }, () =>
      Math.max(2, base.rowHeights[r] ?? newRowH),
    ),
    ...rowH.slice(insertAt),
  ])
  const addW = insertCount * newColW
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const oldW = base.width > 0 ? base.width : tableContentWidth(base)

  return syncTableSize({
    ...el,
    width: oldW + addW,
    height: oldH,
    cols: el.cols + insertCount,
    cells: nextCells,
    colWidths: [
      ...colWidths.slice(0, insertAt),
      ...blankWidths,
      ...colWidths.slice(insertAt),
    ],
    rowColWidths,
    rowColHeights,
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

  const base = ensureRowColHeights(ensureRowColWidths(el))
  let removedH = 0
  for (let r = start; r < end; r++) {
    removedH += rowSpanHeight(
      base.rowColHeights![r],
      el.rowHeights[r] ?? 8,
    )
  }
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const oldW = base.width > 0 ? base.width : tableContentWidth(base)
  const nextRows = el.rows - deleteCount
  return clampMergedCells(
    syncTableSize({
      ...el,
      width: oldW,
      height: Math.max(nextRows * 2, oldH - removedH),
      rows: nextRows,
      cells: [...cells.slice(0, start), ...cells.slice(end)],
      rowHeights: [
        ...el.rowHeights.slice(0, start),
        ...el.rowHeights.slice(end),
      ],
      rowColWidths: base.rowColWidths!.filter(
        (_, i) => i < start || i >= end,
      ),
      rowColHeights: base.rowColHeights!.filter(
        (_, i) => i < start || i >= end,
      ),
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

  const base = ensureRowColHeights(ensureRowColWidths(el))
  let removedW = 0
  for (let c = start; c < end; c++) {
    removedW += colSpanWidth(c, base.rowColWidths!, el.colWidths[c] ?? 20)
  }
  const oldH = base.height > 0 ? base.height : tableContentHeight(base)
  const oldW = base.width > 0 ? base.width : tableContentWidth(base)
  const nextCols = el.cols - deleteCount
  return clampMergedCells(
    syncTableSize({
      ...el,
      width: Math.max(nextCols * 4, oldW - removedW),
      height: oldH,
      cols: nextCols,
      cells: cells.map((row) => [
        ...row.slice(0, start),
        ...row.slice(end),
      ]),
      colWidths: [
        ...el.colWidths.slice(0, start),
        ...el.colWidths.slice(end),
      ],
      rowColWidths: base.rowColWidths!.map((row) => [
        ...row.slice(0, start),
        ...row.slice(end),
      ]),
      rowColHeights: base.rowColHeights!.map((row) => [
        ...row.slice(0, start),
        ...row.slice(end),
      ]),
    }),
  )
}

/** 批量删除多行（至少保留 1 行），从高索引向低索引删 */
export function deleteRowsAtIndices(
  el: TableElement,
  indices: number[],
): TableElement | null {
  const rows = [...new Set(indices)]
    .filter((r) => r >= 0 && r < el.rows)
    .sort((a, b) => b - a)
  if (rows.length === 0) return null
  const maxDeletable = el.rows - 1
  const toDelete = rows.slice(0, Math.min(rows.length, maxDeletable))
  let result = el
  for (const row of toDelete) {
    const next = deleteRows(result, row, 1)
    if (!next) return null
    result = next
  }
  return result
}

/** 批量删除多列（至少保留 1 列），从高索引向低索引删 */
export function deleteColsAtIndices(
  el: TableElement,
  indices: number[],
): TableElement | null {
  const cols = [...new Set(indices)]
    .filter((c) => c >= 0 && c < el.cols)
    .sort((a, b) => b - a)
  if (cols.length === 0) return null
  const maxDeletable = el.cols - 1
  const toDelete = cols.slice(0, Math.min(cols.length, maxDeletable))
  let result = el
  for (const col of toDelete) {
    const next = deleteCols(result, col, 1)
    if (!next) return null
    result = next
  }
  return result
}

export function setRowHeight(
  el: TableElement,
  index: number,
  height: number,
): TableElement {
  const base = ensureRowColHeights(el)
  const h = Math.max(2, height)
  const oldH = base.rowHeights[index] ?? 8
  const delta = h - oldH
  const rowHeights = [...base.rowHeights]
  rowHeights[index] = h
  const rowColHeights = base.rowColHeights!.map((row, ri) => {
    if (ri !== index) return [...row]
    return row.map(() => h)
  })
  const newH = Math.max(base.rows * 2, (base.height || tableContentHeight(base)) + delta)
  return syncTableSize({
    ...base,
    height: newH,
    rowHeights,
    rowColHeights,
  })
}

export function setColWidth(
  el: TableElement,
  index: number,
  width: number,
): TableElement {
  const base = ensureRowColWidths(el)
  const w = Math.max(4, width)
  const oldW = base.colWidths[index] ?? 20
  const delta = w - oldW
  const colWidths = [...base.colWidths]
  colWidths[index] = w
  const rowColWidths = base.rowColWidths!.map((row) => {
    const next = [...row]
    next[index] = w
    return next
  })
  const newW = Math.max(base.cols * 4, (base.width || tableContentWidth(base)) + delta)
  return syncTableSize({
    ...base,
    width: newW,
    colWidths,
    rowColWidths,
  })
}

/** Scale row/col sizes proportionally when outer box is resized */
export function resizeTableBox(
  el: TableElement,
  width: number,
  height: number,
): TableElement {
  const base = ensureRowColHeights(ensureRowColWidths(el))
  const w = Math.max(4, width)
  const h = Math.max(4, height)
  const oldW =
    base.rowColWidths![0]?.reduce((a, b) => a + b, 0) ||
    base.colWidths.reduce((a, b) => a + b, 0) ||
    1
  const oldH = base.height || base.rowHeights.reduce((a, b) => a + b, 0) || 1
  const scaleRow = (row: number[]) => {
    const scaled = row.map((c) => Math.max(4, (c / oldW) * w))
    const sumW = scaled.reduce((a, b) => a + b, 0)
    if (scaled.length) {
      scaled[scaled.length - 1] = Math.max(
        4,
        scaled[scaled.length - 1] + (w - sumW),
      )
    }
    return scaled
  }
  const colWidths = scaleRow(base.colWidths)
  const rowColWidths = base.rowColWidths!.map((row) => scaleRow(row))
  const scaleColHeights = (col: number) => {
    const heights = base.rowColHeights!.map((row) =>
      Math.max(2, ((row[col] ?? 8) / oldH) * h),
    )
    const sumH = heights.reduce((a, b) => a + b, 0)
    if (heights.length) {
      heights[heights.length - 1] = Math.max(
        2,
        heights[heights.length - 1] + (h - sumH),
      )
    }
    return heights
  }
  const rowColHeights = Array.from({ length: base.rows }, () =>
    Array.from({ length: base.cols }, () => 2),
  )
  for (let c = 0; c < base.cols; c++) {
    const heights = scaleColHeights(c)
    for (let r = 0; r < base.rows; r++) rowColHeights[r][c] = heights[r]
  }

  return syncTableSize({
    ...base,
    width: w,
    height: h,
    colWidths,
    rowColWidths,
    rowColHeights,
  })
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
  for (let r = 0; r < el.rows; r++) {
    for (let c = 0; c < el.cols; c++) {
      const box = getCellBox(el, r, c)
      if (!box) continue
      if (
        localX >= box.x &&
        localX < box.x + box.w &&
        localY >= box.y &&
        localY < box.y + box.h
      ) {
        return { row: r, col: c }
      }
    }
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
  /** 外边框：顶/底行可单独调整高度 */
  edge?: 'top' | 'bottom'
  /** 主轴位置（列线的 left% / 行线的 top%），0-100 */
  posPct: number
  /** 分段起点百分比 */
  startPct: number
  /** 分段终点百分比 */
  endPct: number
  /** 列线覆盖的行 [spanStart, spanEnd)；行线覆盖的列同理 */
  spanStart: number
  spanEnd: number
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
          spanStart: runStart,
          spanEnd: ri,
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
          spanStart: runStart,
          spanEnd: ci,
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

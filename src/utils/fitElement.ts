import type { LabelElement, TableElement, TextElement } from '../types'
import {
  DEFAULT_TABLE_COLS,
  DEFAULT_TABLE_ROWS,
  fitTableToRect,
  updateAllCells,
  type TableUnitSize,
} from './table'

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

/** 与新建表格相同的适配外框（mm） */
export function defaultFittedTableBox(
  labelW: number,
  labelH: number,
): { tableW: number; tableH: number } {
  const lw = Math.max(5, labelW)
  const lh = Math.max(5, labelH)
  const margin = round1(clamp(Math.min(lw, lh) * 0.05, 0.6, 3))
  const availW = Math.max(3, lw - margin * 2)
  const availH = Math.max(3, lh - margin * 2)
  const scale = clamp(Math.min(lw / 80, lh / 60), 0.32, 2.4)
  return {
    tableW: round1(Math.min(availW, Math.max(8, 50 * scale))),
    tableH: round1(Math.min(availH, Math.max(8, 32 * scale))),
  }
}

/**
 * 当前标签下「默认新建表格」的单行高 / 单列宽。
 * 新增行列时使用该尺寸，与刚插入表格时一致。
 */
export function defaultFittedTableUnitSize(
  labelW: number,
  labelH: number,
): TableUnitSize {
  const { tableW, tableH } = defaultFittedTableBox(labelW, labelH)
  return {
    rowH: Math.max(2, round1(tableH / DEFAULT_TABLE_ROWS)),
    colW: Math.max(4, round1(tableW / DEFAULT_TABLE_COLS)),
  }
}

/**
 * 新建控件按标签纸张尺寸适配。
 * 默认尺寸按约 80×60 mm 设计；标签过小/过大时等比缩放并保证落在标签内。
 */
export function fitNewElementToLabel(
  el: LabelElement,
  labelW: number,
  labelH: number,
): LabelElement {
  const lw = Math.max(5, labelW)
  const lh = Math.max(5, labelH)
  const margin = round1(clamp(Math.min(lw, lh) * 0.05, 0.6, 3))
  const availW = Math.max(3, lw - margin * 2)
  const availH = Math.max(3, lh - margin * 2)

  // 相对参考标签的缩放（控件默认按 80×60 设计）
  const scale = clamp(Math.min(lw / 80, lh / 60), 0.32, 2.4)

  if (el.type === 'table') {
    const { tableW, tableH } = defaultFittedTableBox(lw, lh)
    let table = fitTableToRect(el as TableElement, margin, margin, tableW, tableH)
    const fontScale = clamp(scale, 0.45, 1.8)
    table = updateAllCells(table, {
      fontSize: round1(clamp(9 * fontScale, 5, 18)),
    })
    // 标题行略大
    if (table.cells[0]?.[0] && !table.cells[0][0].covered) {
      const cells = table.cells.map((row) => row.map((c) => ({ ...c })))
      cells[0][0] = {
        ...cells[0][0],
        fontSize: round1(clamp(11 * fontScale, 6, 20)),
      }
      table = { ...table, cells }
    }
    return table
  }

  let width = el.width
  let height = el.height
  let x = margin
  let y = margin

  switch (el.type) {
    case 'text':
      width = round1(Math.min(availW, Math.max(8, 30 * scale)))
      height = round1(Math.min(availH, Math.max(3.5, 8 * scale)))
      break
    case 'barcode':
      width = round1(Math.min(availW, Math.max(12, 40 * scale)))
      height = round1(Math.min(availH, Math.max(6, 12 * scale)))
      break
    case 'qrcode': {
      const side = round1(
        Math.min(availW, availH, Math.max(8, 18 * scale)),
      )
      width = side
      height = side
      break
    }
    case 'rect':
      width = round1(Math.min(availW, Math.max(6, 20 * scale)))
      height = round1(Math.min(availH, Math.max(5, 15 * scale)))
      break
    case 'line':
      width = round1(Math.min(availW, Math.max(8, 30 * scale)))
      height = round1(clamp(0.3 * scale, 0.2, 0.8))
      break
    default:
      width = round1(Math.min(availW, Math.max(6, 20 * scale)))
      height = round1(Math.min(availH, Math.max(3, 10 * scale)))
  }

  // 最终夹紧，保证不超出标签
  width = round1(Math.min(width, availW))
  height = round1(Math.min(height, availH))
  x = round1(clamp(x, 0, Math.max(0, lw - width)))
  y = round1(clamp(y, 0, Math.max(0, lh - height)))

  const next: LabelElement = { ...el, x, y, width, height }

  if (next.type === 'text') {
    const text = next as TextElement
    const fontSize = round1(clamp((text.fontSize || 11) * scale, 5, 28))
    return { ...text, fontSize }
  }

  if (next.type === 'line') {
    return {
      ...next,
      strokeWidth: round1(clamp((next.strokeWidth || 0.3) * scale, 0.15, 1.2)),
      height: round1(clamp(next.height, 0.15, 1.2)),
    }
  }

  if (next.type === 'rect') {
    return {
      ...next,
      strokeWidth: round1(clamp((next.strokeWidth || 0.3) * scale, 0.15, 1.2)),
    }
  }

  return next
}

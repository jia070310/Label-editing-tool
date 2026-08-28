export type ElementType = 'text' | 'table' | 'rect' | 'line' | 'barcode' | 'qrcode'

export interface BaseElement {
  id: string
  type: ElementType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  locked: boolean
}

export interface TextElement extends BaseElement {
  type: 'text'
  /** 由「日期」工具创建时为 date，插入变量时整段替换 */
  textRole?: 'plain' | 'date'
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through'
  color: string
  textAlign: 'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight: number
}

export interface TableCell {
  content: string
  rowspan: number
  colspan: number
  covered: boolean
  backgroundColor: string
  color: string
  /** 缺省时沿用表格 fontFamily（兼容旧模板） */
  fontFamily?: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  textDecoration: 'none' | 'underline' | 'line-through' | 'underline line-through'
  textAlign: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
}

export interface TableElement extends BaseElement {
  type: 'table'
  rows: number
  cols: number
  rowHeights: number[]
  colWidths: number[]
  /** 每行列宽；缺省由 colWidths 推导。用于线条错位移动 */
  rowColWidths?: number[][]
  /** 每列行高 [row][col]；缺省由 rowHeights 推导 */
  rowColHeights?: number[][]
  borderWidth: number
  borderColor: string
  fontFamily: string
  cells: TableCell[][]
}

export interface RectElement extends BaseElement {
  type: 'rect'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface LineElement extends BaseElement {
  type: 'line'
  stroke: string
  strokeWidth: number
}

export interface BarcodeElement extends BaseElement {
  type: 'barcode'
  value: string
  showText: boolean
  format?: BarcodeFormat
}

export type BarcodeFormat = 'CODE128' | 'EAN13' | 'EAN8' | 'UPC' | 'CODE39'

export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H'

export interface QrcodeElement extends BaseElement {
  type: 'qrcode'
  value: string
  errorCorrection?: QrErrorCorrection
}

export type LabelElement =
  | TextElement
  | TableElement
  | RectElement
  | LineElement
  | BarcodeElement
  | QrcodeElement

export type LabelShape = 'rect' | 'round-rect' | 'circle'
export type PrintOrientation = 0 | 90 | 180 | 270
export type PrintRows = 1 | 2 | 3 | 4

export interface LabelSettings {
  width: number
  height: number
  name: string
  shape: LabelShape
  orientation: PrintOrientation
  printRows: PrintRows
}

export interface CellPos {
  row: number
  col: number
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export function defaultLabelSettings(
  partial: Partial<LabelSettings> = {},
): LabelSettings {
  return {
    name: '新建标签_1',
    shape: 'rect',
    width: 40,
    height: 30,
    orientation: 0,
    printRows: 1,
    ...partial,
  }
}

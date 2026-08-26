import type { LabelElement, TableElement } from '../types'

/** 变量占位符：{{字段名}} */
export const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g

/** 常用预设变量（窗帘标签） */
export const PRESET_VARIABLES = [
  '版本',
  '品名',
  '外帘',
  '内帘',
  '纱帘',
  '绑带',
  '价格',
  '高度',
] as const

export type PresetVariable = (typeof PRESET_VARIABLES)[number]

export function variableToken(name: string): string {
  return `{{${name.trim()}}}`
}

export type DataRow = Record<string, string>

export function substituteVariables(
  text: string,
  data: DataRow,
): string {
  return text.replace(VARIABLE_PATTERN, (_, key: string) => {
    const k = key.trim()
    return data[k] ?? ''
  })
}

export function extractVariables(text: string): string[] {
  const found = new Set<string>()
  for (const m of text.matchAll(VARIABLE_PATTERN)) {
    found.add(m[1].trim())
  }
  return [...found]
}

function scanElementVariables(el: LabelElement, out: Set<string>) {
  if (el.type === 'text') {
    extractVariables(el.content).forEach((v) => out.add(v))
  } else if (el.type === 'barcode' || el.type === 'qrcode') {
    extractVariables(el.value).forEach((v) => out.add(v))
  } else if (el.type === 'table') {
    for (const row of el.cells) {
      for (const cell of row) {
        if (!cell.covered) extractVariables(cell.content).forEach((v) => out.add(v))
      }
    }
  }
}

export function extractVariablesFromElements(
  elements: LabelElement[],
): string[] {
  const out = new Set<string>()
  for (const el of elements) scanElementVariables(el, out)
  return [...out]
}

export function applyVariablesToElements(
  elements: LabelElement[],
  data: DataRow,
): LabelElement[] {
  return elements.map((el) => {
    if (el.type === 'text') {
      return { ...el, content: substituteVariables(el.content, data) }
    }
    if (el.type === 'barcode' || el.type === 'qrcode') {
      return { ...el, value: substituteVariables(el.value, data) }
    }
    if (el.type === 'table') {
      const table = el as TableElement
      return {
        ...table,
        cells: table.cells.map((row) =>
          row.map((cell) =>
            cell.covered
              ? cell
              : { ...cell, content: substituteVariables(cell.content, data) },
          ),
        ),
      }
    }
    return el
  })
}

export function buildSampleCsv(headers: string[]): string {
  const cols =
    headers.length > 0 ? headers : ([...PRESET_VARIABLES] as string[])
  const sample1: Record<string, string> = {
    版本: '暖居',
    品名: '浅月歌',
    外帘: 'JC606-1',
    内帘: 'DSBJ25-7',
    纱帘: 'YS-01',
    绑带: '标准',
    价格: '388',
    高度: '270',
  }
  const sample2: Record<string, string> = {
    版本: '简约',
    品名: '云端',
    外帘: 'JC808-2',
    内帘: 'DSBJ30-1',
    纱帘: 'YS-02',
    绑带: '加长',
    价格: '498',
    高度: '280',
  }
  const row1 = cols.map((h, i) => sample1[h] ?? `示例${h}${i + 1}`).join(',')
  const row2 = cols.map((h, i) => sample2[h] ?? `示例${h}${i + 10}`).join(',')
  return `${cols.join(',')}\n${row1}\n${row2}`
}

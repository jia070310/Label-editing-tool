import type { LabelElement, TableElement, TextElement } from '../types'
import {
  applyVariablesToElements,
  substituteVariables,
  type DataRow,
} from './variables'
import {
  cellHasTranslation,
  hasChinese,
  mergeTranslationIntoCell,
  pickSourceText,
  removeTranslationFromCell,
} from './translate'

export type TranslationSlot = {
  key: string
  label: string
  kind: 'table' | 'text'
  elementId: string
  row?: number
  col?: number
}

export type RowTranslateStatus = 'idle' | 'pending' | 'ready' | 'error'

/** 模板中已有「中文+英文翻译行」的位置 */
export function findTranslationSlots(
  elements: LabelElement[],
): TranslationSlot[] {
  const slots: TranslationSlot[] = []
  for (const el of elements) {
    if (el.type === 'text') {
      if (cellHasTranslation(el.content) && hasChinese(el.content)) {
        slots.push({
          key: `text:${el.id}`,
          label: '文本',
          kind: 'text',
          elementId: el.id,
        })
      }
    } else if (el.type === 'table') {
      const table = el as TableElement
      for (let r = 0; r < table.rows; r++) {
        for (let c = 0; c < table.cols; c++) {
          const cell = table.cells[r]?.[c]
          if (!cell || cell.covered) continue
          if (!cellHasTranslation(cell.content)) continue
          if (!hasChinese(cell.content)) continue
          const first = cell.content.split('\n')[0]?.trim() ?? ''
          slots.push({
            key: `table:${el.id}:${r}:${c}`,
            label: first.replace(/\{\{|\}\}/g, '').slice(0, 12) || `格${r + 1}-${c + 1}`,
            kind: 'table',
            elementId: el.id,
            row: r,
            col: c,
          })
        }
      }
    }
  }
  return slots
}

function slotTemplateContent(
  elements: LabelElement[],
  slot: TranslationSlot,
): string {
  const el = elements.find((e) => e.id === slot.elementId)
  if (!el) return ''
  if (slot.kind === 'text' && el.type === 'text') return el.content
  if (slot.kind === 'table' && el.type === 'table') {
    return el.cells[slot.row!]?.[slot.col!]?.content ?? ''
  }
  return ''
}

/** 某行数据代入变量后，该槽位待翻译的中文 */
export function getSlotSource(
  elements: LabelElement[],
  slot: TranslationSlot,
  data: DataRow,
): string {
  const raw = slotTemplateContent(elements, slot)
  const substituted = substituteVariables(raw, data)
  // 去掉旧英文行，只取中文首行
  const chineseOnly = removeTranslationFromCell(substituted)
  const source = pickSourceText(chineseOnly, '')
  return hasChinese(source) ? source.trim() : ''
}

export function collectUniqueSources(
  elements: LabelElement[],
  slots: TranslationSlot[],
  rows: DataRow[],
): string[] {
  const set = new Set<string>()
  for (const row of rows) {
    for (const slot of slots) {
      const s = getSlotSource(elements, slot, row)
      if (s) set.add(s)
    }
  }
  return [...set]
}

/** 预计算每行待翻译中文，避免表格每次渲染重复扫描模板 */
export function buildRowSources(
  elements: LabelElement[],
  slots: TranslationSlot[],
  rows: DataRow[],
): string[][] {
  return rows.map((row) => {
    const set = new Set<string>()
    for (const slot of slots) {
      const s = getSlotSource(elements, slot, row)
      if (s) set.add(s)
    }
    return [...set]
  })
}

/** 优先翻译预览行相关文案，其余去重排在后面 */
export function orderSourcesForPreview(
  allSources: string[],
  previewSources: string[],
): string[] {
  const previewSet = new Set(previewSources)
  const first = allSources.filter((s) => previewSet.has(s))
  const rest = allSources.filter((s) => !previewSet.has(s))
  return [...first, ...rest]
}

export function rowStatusFromSources(
  sources: string[],
  cache: Record<string, string>,
  failed: Set<string>,
): RowTranslateStatus {
  if (sources.length === 0) return 'ready'
  if (sources.some((s) => failed.has(s))) return 'error'
  if (sources.every((s) => !!cache[s])) return 'ready'
  return 'pending'
}

export function formatTranslationsFromSources(
  sources: string[],
  cache: Record<string, string>,
): string {
  return sources.map((s) => cache[s]).filter(Boolean).join(' · ')
}

export function countReadyRows(
  rowSources: string[][],
  cache: Record<string, string>,
  failed: Set<string>,
): number {
  return rowSources.filter(
    (sources) => rowStatusFromSources(sources, cache, failed) === 'ready',
  ).length
}

/** 将缓存中的译文写入已替换变量的元素 */
export function applyTranslationsToElements(
  elements: LabelElement[],
  slots: TranslationSlot[],
  cache: Record<string, string>,
): LabelElement[] {
  if (slots.length === 0) return elements

  return elements.map((el) => {
    if (el.type === 'text') {
      const slot = slots.find((s) => s.kind === 'text' && s.elementId === el.id)
      if (!slot) return el
      const chineseOnly = removeTranslationFromCell(el.content)
      const src = pickSourceText(chineseOnly, '').trim()
      if (!src || !hasChinese(src)) {
        return {
          ...(el as TextElement),
          content: chineseOnly,
        }
      }
      const en = cache[src]
      if (!en) {
        return {
          ...(el as TextElement),
          content: chineseOnly,
        }
      }
      return {
        ...(el as TextElement),
        content: mergeTranslationIntoCell(chineseOnly, src, en),
      }
    }

    if (el.type === 'table') {
      const table = el as TableElement
      let changed = false
      const cells = table.cells.map((row, r) =>
        row.map((cell, c) => {
          const slot = slots.find(
            (s) =>
              s.kind === 'table' &&
              s.elementId === el.id &&
              s.row === r &&
              s.col === c,
          )
          if (!slot || cell.covered) return cell
          const chineseOnly = removeTranslationFromCell(cell.content)
          const src = pickSourceText(chineseOnly, '').trim()
          if (!src || !hasChinese(src)) {
            return { ...cell, content: chineseOnly }
          }
          const en = cache[src]
          if (!en) {
            changed = true
            return { ...cell, content: chineseOnly }
          }
          changed = true
          return {
            ...cell,
            content: mergeTranslationIntoCell(chineseOnly, src, en),
          }
        }),
      )
      return changed ? { ...table, cells } : el
    }

    return el
  })
}

/** 变量替换 + 按行应用译文 */
export function prepareBatchElements(
  template: LabelElement[],
  data: DataRow,
  slots: TranslationSlot[],
  cache: Record<string, string>,
): LabelElement[] {
  const withVars = applyVariablesToElements(template, data)
  if (slots.length === 0) return withVars
  return applyTranslationsToElements(withVars, slots, cache)
}

export function rowTranslationStatus(
  elements: LabelElement[],
  slots: TranslationSlot[],
  data: DataRow,
  cache: Record<string, string>,
  failed: Set<string>,
): RowTranslateStatus {
  if (slots.length === 0) return 'ready'
  const sources = slots
    .map((s) => getSlotSource(elements, s, data))
    .filter(Boolean)
  if (sources.length === 0) return 'ready'
  if (sources.some((s) => failed.has(s))) return 'error'
  if (sources.every((s) => !!cache[s])) return 'ready'
  return 'pending'
}

export function formatRowTranslations(
  elements: LabelElement[],
  slots: TranslationSlot[],
  data: DataRow,
  cache: Record<string, string>,
): string {
  const parts: string[] = []
  for (const slot of slots) {
    const src = getSlotSource(elements, slot, data)
    if (!src) continue
    const en = cache[src]
    if (en) parts.push(en)
  }
  return parts.join(' · ')
}

/** 打印至少需要多少条已译好的数据（不足总数时按总数） */
export const MIN_READY_ROWS_FOR_PRINT = 5

export function printReadyRequirement(totalRows: number): number {
  return Math.min(MIN_READY_ROWS_FOR_PRINT, Math.max(totalRows, 0))
}

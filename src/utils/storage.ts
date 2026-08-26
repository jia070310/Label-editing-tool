import type { LabelElement, LabelSettings } from '../types'

export interface LabelTemplate {
  id: string
  settings: LabelSettings
  elements: LabelElement[]
  updatedAt: number
  createdAt: number
}

const STORAGE_KEY = 'label-print-templates'

export function loadTemplates(): LabelTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as LabelTemplate[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function saveTemplates(list: LabelTemplate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}

export function upsertTemplate(template: LabelTemplate): LabelTemplate[] {
  const list = loadTemplates()
  const idx = list.findIndex((t) => t.id === template.id)
  const next = { ...template, updatedAt: Date.now() }
  if (idx >= 0) list[idx] = next
  else list.unshift(next)
  saveTemplates(list)
  return list
}

export function deleteTemplate(id: string): LabelTemplate[] {
  const list = loadTemplates().filter((t) => t.id !== id)
  saveTemplates(list)
  return list
}

export function renameTemplate(id: string, name: string): LabelTemplate[] {
  const trimmed = name.trim()
  if (!trimmed) return loadTemplates()
  const list = loadTemplates()
  const idx = list.findIndex((t) => t.id === id)
  if (idx < 0) return list
  list[idx] = {
    ...list[idx],
    settings: { ...list[idx].settings, name: trimmed },
    updatedAt: Date.now(),
  }
  saveTemplates(list)
  return list
}

export function nextDefaultName(templates: LabelTemplate[]): string {
  let n = 1
  const names = new Set(templates.map((t) => t.settings.name))
  while (names.has(`新建标签_${n}`)) n += 1
  return `新建标签_${n}`
}

/** 模板文件标识（导出 / 导入） */
export const TEMPLATE_FILE_FORMAT = 'lemon-label-template'
export const TEMPLATE_FILE_VERSION = 1
export const TEMPLATE_FILE_EXT = 'nmlabel'

export interface LabelTemplateFile {
  format: typeof TEMPLATE_FILE_FORMAT
  version: number
  exportedAt: number
  template: LabelTemplate
}

export function serializeTemplateFile(template: LabelTemplate): string {
  const payload: LabelTemplateFile = {
    format: TEMPLATE_FILE_FORMAT,
    version: TEMPLATE_FILE_VERSION,
    exportedAt: Date.now(),
    template: structuredClone(template),
  }
  return JSON.stringify(payload, null, 2)
}

export function parseTemplateFile(raw: string): LabelTemplate {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('无法解析模板文件，请确认是本工具导出的文件')
  }
  if (!data || typeof data !== 'object') {
    throw new Error('模板文件格式无效')
  }
  const obj = data as Record<string, unknown>
  // 兼容：整份即模板，或带 format 包装
  const tplRaw =
    obj.format === TEMPLATE_FILE_FORMAT && obj.template
      ? obj.template
      : obj.settings && obj.elements
        ? obj
        : null
  if (!tplRaw || typeof tplRaw !== 'object') {
    throw new Error('不是有效的柠檬标签模板文件')
  }
  const tpl = tplRaw as Partial<LabelTemplate>
  if (!tpl.settings || typeof tpl.settings !== 'object') {
    throw new Error('模板缺少标签设置')
  }
  if (!Array.isArray(tpl.elements)) {
    throw new Error('模板缺少元素列表')
  }
  const settings = tpl.settings as LabelTemplate['settings']
  if (
    typeof settings.width !== 'number' ||
    typeof settings.height !== 'number' ||
    !settings.name
  ) {
    throw new Error('模板标签尺寸或名称无效')
  }
  return {
    id: typeof tpl.id === 'string' && tpl.id ? tpl.id : crypto.randomUUID(),
    settings,
    elements: tpl.elements as LabelTemplate['elements'],
    createdAt: typeof tpl.createdAt === 'number' ? tpl.createdAt : Date.now(),
    updatedAt: typeof tpl.updatedAt === 'number' ? tpl.updatedAt : Date.now(),
  }
}

/** 导入时分配新 id，并避免名称冲突 */
export function prepareImportedTemplate(
  tpl: LabelTemplate,
  existing: LabelTemplate[],
): LabelTemplate {
  const names = new Set(existing.map((t) => t.settings.name))
  let name = (tpl.settings.name || '导入模板').trim() || '导入模板'
  if (names.has(name)) {
    let n = 2
    while (names.has(`${name} (${n})`)) n += 1
    name = `${name} (${n})`
  }
  const now = Date.now()
  return {
    ...tpl,
    id: crypto.randomUUID(),
    settings: { ...tpl.settings, name },
    elements: structuredClone(tpl.elements),
    createdAt: now,
    updatedAt: now,
  }
}

export function defaultExportFileName(template: LabelTemplate): string {
  const safe = (template.settings.name || '模板')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim()
    .slice(0, 40)
  return `${safe || '模板'}.${TEMPLATE_FILE_EXT}`
}

export { DESIGN_DPI, MM_TO_PX, mmToPx, ptToPx, mmStyle, ptStyle } from './dpi'

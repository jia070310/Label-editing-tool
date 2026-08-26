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

export { DESIGN_DPI, MM_TO_PX, mmToPx, ptToPx, mmStyle, ptStyle } from './dpi'

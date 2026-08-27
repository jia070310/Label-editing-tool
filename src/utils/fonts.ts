import { useEffect, useState } from 'react'

export type FontOption = { value: string; label: string }

export const FALLBACK_FONT_OPTIONS: FontOption[] = [
  { value: 'SimHei, "Microsoft YaHei", sans-serif', label: '黑体' },
  { value: '"SimSun", serif', label: '宋体' },
  { value: '"Microsoft YaHei", sans-serif', label: '微软雅黑' },
  { value: 'Arial, sans-serif', label: 'Arial' },
]

const PIN_ORDER = [
  'SimHei',
  'Microsoft YaHei',
  'Microsoft YaHei UI',
  'SimSun',
  'NSimSun',
  'KaiTi',
  'FangSong',
  'DengXian',
  'Source Han Sans SC',
  'Noto Sans SC',
  'Arial',
  'Times New Roman',
  'Calibri',
  'Tahoma',
  'Segoe UI',
]

const LABEL_ALIASES: Record<string, string> = {
  SimHei: '黑体',
  'Microsoft YaHei': '微软雅黑',
  'Microsoft YaHei UI': '微软雅黑 UI',
  SimSun: '宋体',
  NSimSun: '新宋体',
  KaiTi: '楷体',
  FangSong: '仿宋',
  DengXian: '等线',
  'Source Han Sans SC': '思源黑体',
  'Noto Sans SC': 'Noto 黑体',
}

export function toFontFamilyCss(name: string): string {
  const n = name.trim()
  if (!n) return 'sans-serif'
  if (n.includes(',')) return n
  const needsQuote = /[\s"'`]/.test(n) || /[^a-zA-Z0-9_-]/.test(n)
  const quoted = needsQuote ? `"${n.replace(/"/g, '')}"` : n
  return `${quoted}, sans-serif`
}

export function buildFontOptions(names: string[]): FontOption[] {
  const uniq = Array.from(
    new Set(
      names
        .map((n) => n.trim())
        .filter((n) => n.length > 0 && !n.startsWith('@')),
    ),
  )
  const pinRank = new Map(PIN_ORDER.map((n, i) => [n.toLowerCase(), i]))
  uniq.sort((a, b) => {
    const ra = pinRank.get(a.toLowerCase())
    const rb = pinRank.get(b.toLowerCase())
    if (ra != null && rb != null) return ra - rb
    if (ra != null) return -1
    if (rb != null) return 1
    return a.localeCompare(b, 'zh-CN')
  })
  return uniq.map((name) => ({
    value: toFontFamilyCss(name),
    label: LABEL_ALIASES[name] ?? name,
  }))
}

export function withCurrentFontOption(
  options: FontOption[],
  current: string | undefined,
): FontOption[] {
  if (!current) return options
  if (options.some((o) => o.value === current)) return options
  const bare = current.split(',')[0]?.trim().replace(/^["']|["']$/g, '') || current
  return [{ value: current, label: LABEL_ALIASES[bare] ?? bare }, ...options]
}

async function loadFontNamesFromElectron(): Promise<string[]> {
  const api = window.electronAPI
  if (!api?.getSystemFonts) return []
  try {
    const list = await api.getSystemFonts()
    return Array.isArray(list) ? list.filter((n) => typeof n === 'string') : []
  } catch {
    return []
  }
}

async function loadFontNamesFromBrowser(): Promise<string[]> {
  const query = (
    window as Window & {
      queryLocalFonts?: () => Promise<Array<{ family: string }>>
    }
  ).queryLocalFonts
  if (typeof query !== 'function') return []
  try {
    const fonts = await query()
    return fonts.map((f) => f.family)
  } catch {
    return []
  }
}

export async function loadSystemFontNames(): Promise<string[]> {
  const fromElectron = await loadFontNamesFromElectron()
  if (fromElectron.length) return fromElectron
  return loadFontNamesFromBrowser()
}

export function useSystemFonts(): FontOption[] {
  const [fonts, setFonts] = useState<FontOption[]>(FALLBACK_FONT_OPTIONS)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const names = await loadSystemFontNames()
      if (cancelled || !names.length) return
      setFonts(buildFontOptions(names))
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return fonts
}

import type { LabelSettings } from '../types'

export interface ElectronPrintAPI {
  isElectron: true
  printLabel: (payload: {
    dataUrl: string
    widthMm: number
    heightMm: number
    dpi?: number
    deviceName?: string
    silent?: boolean
  }) => Promise<{ ok: boolean; cancelled?: boolean; logPath?: string }>
  getPrinters: () => Promise<
    Array<{ name: string; displayName?: string; isDefault?: boolean }>
  >
  getPrintLogPath?: () => Promise<string>
  openPrintLog?: () => Promise<{ ok: boolean; path: string; error?: string }>
  reportClientError?: (payload: Record<string, unknown>) => Promise<{ ok: boolean }>
  exportFeedbackLog?: () => Promise<{
    ok: boolean
    cancelled?: boolean
    path?: string
  }>
  saveTextFile?: (payload: {
    title?: string
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
    content: string
  }) => Promise<{ ok: boolean; cancelled?: boolean; path?: string }>
  openTextFile?: (payload?: {
    title?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => Promise<{
    ok: boolean
    cancelled?: boolean
    path?: string
    content?: string
  }>
}

export function isElectronApp(): boolean {
  return !!window.electronAPI?.isElectron
}

export function getPrintPageSize(settings: LabelSettings): {
  widthMm: number
  heightMm: number
} {
  const rotated =
    settings.orientation === 90 || settings.orientation === 270
  return {
    widthMm: rotated ? settings.height : settings.width,
    heightMm: rotated ? settings.width : settings.height,
  }
}

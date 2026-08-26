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
  }) => Promise<{ ok: boolean; cancelled?: boolean }>
  getPrinters: () => Promise<
    Array<{ name: string; displayName?: string; isDefault?: boolean }>
  >
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

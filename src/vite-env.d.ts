/// <reference types="vite/client" />

import type { ElectronPrintAPI } from './utils/electron'

declare global {
  interface Window {
    electronAPI?: ElectronPrintAPI
  }
}

export {}

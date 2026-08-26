import type { ElectronPrintAPI } from './electron'

declare global {
  interface Window {
    electronAPI?: ElectronPrintAPI
  }
}

export async function reportClientError(
  error: unknown,
  context?: Record<string, unknown>,
) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : String(error)
  const stack = error instanceof Error ? error.stack : undefined
  const payload = {
    message,
    stack,
    href: typeof location !== 'undefined' ? location.href : '',
    time: new Date().toISOString(),
    ...context,
  }
  console.error('[feedback]', payload)
  try {
    await window.electronAPI?.reportClientError?.(payload)
  } catch {
    /* ignore */
  }
}

export async function exportFeedbackLog() {
  if (!window.electronAPI?.exportFeedbackLog) {
    throw new Error('请使用桌面版导出反馈日志')
  }
  return window.electronAPI.exportFeedbackLog()
}

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  printLabel: (payload) => ipcRenderer.invoke('print-label', payload),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  getPrintLogPath: () => ipcRenderer.invoke('get-print-log-path'),
  openPrintLog: () => ipcRenderer.invoke('open-print-log'),
  reportClientError: (payload) =>
    ipcRenderer.invoke('report-client-error', payload),
  exportFeedbackLog: (payload) =>
    ipcRenderer.invoke('export-feedback-log', payload || {}),
  saveTextFile: (payload) => ipcRenderer.invoke('save-text-file', payload),
  openTextFile: (payload) => ipcRenderer.invoke('open-text-file', payload || {}),
  getSystemFonts: () => ipcRenderer.invoke('get-system-fonts'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
})

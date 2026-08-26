const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  printLabel: (payload) => ipcRenderer.invoke('print-label', payload),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
})

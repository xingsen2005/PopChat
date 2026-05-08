const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath)
})
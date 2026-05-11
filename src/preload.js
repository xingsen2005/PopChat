const { ipcRenderer, contextBridge } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  checkUpdates: () => ipcRenderer.invoke('check-updates'),
  showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  readFileContent: (filePath) => ipcRenderer.invoke('read-file-content', filePath),
  safeStorageEncrypt: (text) => ipcRenderer.invoke('safe-storage-encrypt', text),
  safeStorageDecrypt: (encryptedBase64) => ipcRenderer.invoke('safe-storage-decrypt', encryptedBase64),
  apiRequest: (options) => ipcRenderer.invoke('api-request', options),
  fetchTokenQuota: (options) => ipcRenderer.invoke('fetch-token-quota', options),
  apiStreamRequest: (options) => ipcRenderer.invoke('api-stream-request', options),
  apiStreamAbort: (streamId) => ipcRenderer.invoke('api-stream-abort', streamId),
  onApiStreamChunk: (callback) =>
  {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('api-stream-chunk', handler)
    return handler
  },
  onApiStreamError: (callback) =>
  {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('api-stream-error', handler)
    return handler
  },
  onApiStreamDone: (callback) =>
  {
    const handler = (_, data) => callback(data)
    ipcRenderer.on('api-stream-done', handler)
    return handler
  },
  removeApiStreamListeners: (handlers) =>
  {
    if (handlers)
    {
      if (handlers.chunk) ipcRenderer.removeListener('api-stream-chunk', handlers.chunk)
      if (handlers.error) ipcRenderer.removeListener('api-stream-error', handlers.error)
      if (handlers.done) ipcRenderer.removeListener('api-stream-done', handlers.done)
    }
    else
    {
      ipcRenderer.removeAllListeners('api-stream-chunk')
      ipcRenderer.removeAllListeners('api-stream-error')
      ipcRenderer.removeAllListeners('api-stream-done')
    }
  }
})

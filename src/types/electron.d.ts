declare global {
  interface Window {
    electronAPI: {
      checkUpdates: () => Promise<{ success: boolean; error?: string; message?: string }>
      showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
      showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>
      readFileContent: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
      safeStorageEncrypt: (text: string) => Promise<{ success: boolean; data?: string; error?: string }>
      safeStorageDecrypt: (encryptedBase64: string) => Promise<{ success: boolean; data?: string; error?: string }>
      apiRequest: (options: {
        url: string
        method?: string
        provider: string
        apiKey: string
        body?: Record<string, unknown>
      }) => Promise<{
        ok: boolean
        status: number
        data: unknown
        error?: { code: string; message: string }
      }>
      fetchTokenQuota: (options: {
        provider: string
        apiKey: string
        baseURL: string
        balanceEndpoint: string
      }) => Promise<{
        success: boolean
        quota?: {
          available: number
          total: number
          currency: string
          label: string
        }
        error?: string
      }>
      apiStreamRequest: (options: {
        url: string
        provider: string
        apiKey: string
        body: Record<string, unknown>
        streamId: string
      }) => Promise<{ success: boolean }>
      apiStreamAbort: (streamId?: string) => Promise<{ success: boolean }>
      onApiStreamChunk: (callback: (data: { content: string; streamId: string }) => void) => unknown
      onApiStreamError: (callback: (data: { status: number; data: unknown; streamId: string }) => void) => unknown
      onApiStreamDone: (callback: (data: { streamId: string }) => void) => unknown
      removeApiStreamListeners: (handlers?: { chunk?: unknown; error?: unknown; done?: unknown }) => void
    }
  }
}

export {}

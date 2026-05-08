declare global {
  interface Window {
    electronAPI: {
      checkUpdates: () => Promise<{ success: boolean; error?: string; message?: string }>
      showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
      showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>
      readFileContent: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
    }
  }
}

export {}
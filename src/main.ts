import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import path from 'path'
import fs from 'fs'

let autoUpdater: any = null
try
{
  autoUpdater = require('electron-updater').autoUpdater
}
catch
{
  autoUpdater = null
}

const isDev = process.env.NODE_ENV === 'development'

let mainWindow: BrowserWindow | null = null

const createWindow = () =>
{
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AI 桌面助手',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js'),
    }
  })

  if (isDev)
  {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  }
  else
  {
    mainWindow.loadFile(path.join(__dirname, 'index.html'))
  }

  mainWindow.on('closed', () =>
  {
    mainWindow = null
  })

  Menu.setApplicationMenu(null)
}

if (autoUpdater)
{
  autoUpdater.autoDownload = false
  autoUpdater.on('update-available', () =>
  {
    if (!mainWindow) return
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '发现更新',
      message: '发现新版本，是否立即下载？',
      buttons: ['下载', '稍后']
    }).then((result) =>
    {
      if (result.response === 0)
      {
        autoUpdater.downloadUpdate()
      }
    })
  })

  autoUpdater.on('update-downloaded', () =>
  {
    if (!mainWindow) return
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: '更新就绪',
      message: '更新已下载完成，重启应用以应用更新。',
      buttons: ['重启', '稍后']
    }).then((result) =>
    {
      if (result.response === 0)
      {
        autoUpdater.quitAndInstall()
      }
    })
  })
}

ipcMain.handle('check-updates', async () =>
{
  if (!isDev && autoUpdater)
  {
    try
    {
      await autoUpdater.checkForUpdates()
      return { success: true }
    }
    catch (error)
    {
      return { success: false, error: (error as Error).message }
    }
  }
  return { success: true, message: 'Running in development mode' }
})

ipcMain.handle('show-open-dialog', async (_, options) =>
{
  if (!mainWindow) return { canceled: true, filePaths: [] }
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})

ipcMain.handle('show-message-box', async (_, options) =>
{
  if (!mainWindow)
  {
    return { response: 0, checkboxChecked: false }
  }
  const result = await dialog.showMessageBox(mainWindow, options)
  return result
})

ipcMain.handle('read-file-content', async (_, filePath: string) =>
{
  try
  {
    const resolved = path.resolve(filePath)
    const stats = await fs.promises.stat(resolved)
    const maxSize = 10 * 1024 * 1024

    if (stats.size > maxSize)
    {
      return { success: false, error: '文件过大（最大 10MB）' }
    }

    const content = await fs.promises.readFile(resolved, 'utf-8')
    return { success: true, content }
  }
  catch (error)
  {
    return { success: false, error: (error as Error).message }
  }
})

app.whenReady().then(() =>
{
  createWindow()

  if (!isDev && autoUpdater)
  {
    autoUpdater.checkForUpdates()
  }

  app.on('activate', () =>
  {
    if (BrowserWindow.getAllWindows().length === 0)
    {
      createWindow()
    }
  })
})

app.on('window-all-closed', () =>
{
  if (process.platform !== 'darwin')
  {
    app.quit()
  }
})

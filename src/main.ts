import { app, BrowserWindow, ipcMain, dialog, Menu, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

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
const streamAbortControllers = new Map<string, AbortController>()

// 智谱 API JWT Token 生成
// 注意：智谱 API 使用毫秒级时间戳（非标准 JWT 的秒级），这是智谱的约定
const generateZhipuToken = (apiKey: string): string =>
{
  const parts = apiKey.split('.')
  if (parts.length !== 2)
  {
    return apiKey
  }

  const [id, secret] = parts
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', sign_type: 'SIGN' })).toString('base64url')
  const now = Date.now()
  const payload = Buffer.from(JSON.stringify({
    api_key: id,
    exp: now + 3600 * 1000,
    timestamp: now
  })).toString('base64url')
  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url')

  return `${header}.${payload}.${signature}`
}

const getAuthHeader = (provider: string, apiKey: string): string =>
{
  if (provider === 'zhipu')
  {
    return `Bearer ${generateZhipuToken(apiKey)}`
  }
  return `Bearer ${apiKey}`
}

const createWindow = () =>
{
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '轻言 AI 助手',
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
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'))
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
  const safeOptions: Electron.OpenDialogOptions = {
    title: typeof options?.title === 'string' ? options.title : undefined,
    defaultPath: typeof options?.defaultPath === 'string' ? options.defaultPath : undefined,
    filters: Array.isArray(options?.filters) ? options.filters : undefined,
    properties: Array.isArray(options?.properties) ? options.properties.filter((p: string) =>
      typeof p === 'string' && [
        'openFile', 'openDirectory', 'multiSelections', 'showHiddenFiles',
        'createDirectory', 'promptToCreate', 'dontAddToRecent'
      ].includes(p)
    ) : undefined
  }
  const result = await dialog.showOpenDialog(mainWindow, safeOptions)
  return result
})

ipcMain.handle('show-message-box', async (_, options) =>
{
  if (!mainWindow)
  {
    return { response: 0, checkboxChecked: false }
  }
  const safeOptions: Electron.MessageBoxOptions = {
    type: ['none', 'info', 'error', 'question', 'warning'].includes(options?.type) ? options.type : 'info',
    title: typeof options?.title === 'string' ? options.title : undefined,
    message: typeof options?.message === 'string' ? options.message : '',
    detail: typeof options?.detail === 'string' ? options.detail : undefined,
    buttons: Array.isArray(options?.buttons) ? options.buttons.slice(0, 5).filter((b: unknown) => typeof b === 'string') : undefined,
    defaultId: typeof options?.defaultId === 'number' ? options.defaultId : undefined,
    cancelId: typeof options?.cancelId === 'number' ? options.cancelId : undefined
  }
  const result = await dialog.showMessageBox(mainWindow, safeOptions)
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

    const allowedExtensions = [
      '.txt', '.md', '.json', '.csv', '.xml', '.yaml', '.yml',
      '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h',
      '.css', '.html', '.sql', '.sh', '.bat', '.ps1',
      '.log', '.ini', '.cfg', '.conf', '.env', '.toml'
    ]
    const ext = path.extname(resolved).toLowerCase()
    if (ext && !allowedExtensions.includes(ext))
    {
      return { success: false, error: `不支持的文件类型：${ext}` }
    }

    const content = await fs.promises.readFile(resolved, 'utf-8')
    return { success: true, content }
  }
  catch (error)
  {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('safe-storage-encrypt', async (_, text: string) =>
{
  if (!safeStorage.isEncryptionAvailable())
  {
    return { success: false, error: '系统加密不可用' }
  }
  try
  {
    const encrypted = safeStorage.encryptString(text)
    return { success: true, data: encrypted.toString('base64') }
  }
  catch (error)
  {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('safe-storage-decrypt', async (_, encryptedBase64: string) =>
{
  if (!safeStorage.isEncryptionAvailable())
  {
    return { success: false, error: '系统加密不可用' }
  }
  try
  {
    const buffer = Buffer.from(encryptedBase64, 'base64')
    const decrypted = safeStorage.decryptString(buffer)
    return { success: true, data: decrypted }
  }
  catch (error)
  {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('api-request', async (_, options: {
  url: string
  method?: string
  provider: string
  apiKey: string
  body?: Record<string, unknown>
}) =>
{
  const { url, method, provider, apiKey, body } = options
  try
  {
    let finalUrl = url
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (provider === 'google')
    {
      const separator = finalUrl.includes('?') ? '&' : '?'
      finalUrl = `${finalUrl}${separator}key=${encodeURIComponent(apiKey)}`
    }
    else if (provider === 'anthropic')
    {
      headers['anthropic-version'] = '2023-06-01'
      headers['x-api-key'] = apiKey
    }
    else
    {
      headers['Authorization'] = getAuthHeader(provider, apiKey)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    const response = await fetch(finalUrl, {
      method: method || 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    let data: unknown = null
    try
    {
      data = await response.json()
    }
    catch
    {
      // ignore JSON parse error
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    }
  }
  catch (error: unknown)
  {
    const err = error as Error & { cause?: { code?: string } }
    let code = 'NETWORK_ERROR'
    let message = '网络错误'

    if (err.name === 'AbortError')
    {
      code = 'TIMEOUT'
      message = '请求超时'
    }
    else if (err.cause?.code === 'ECONNREFUSED')
    {
      message = '连接被拒绝'
    }
    else if (err.cause?.code === 'ENOTFOUND')
    {
      message = 'DNS 解析失败'
    }

    return { ok: false, status: 0, error: { code, message }, data: null }
  }
})

ipcMain.handle('fetch-token-quota', async (_, options: {
  provider: string
  apiKey: string
  baseURL: string
  balanceEndpoint: string
}) =>
{
  const { provider, apiKey, baseURL, balanceEndpoint } = options
  const url = `${baseURL}${balanceEndpoint}`

  try
  {
    let finalUrl = url
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (provider === 'google')
    {
      const separator = finalUrl.includes('?') ? '&' : '?'
      finalUrl = `${finalUrl}${separator}key=${encodeURIComponent(apiKey)}`
    }
    else
    {
      headers['Authorization'] = getAuthHeader(provider, apiKey)
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok)
    {
      return {
        success: false,
        error: `请求失败，状态码 ${response.status}`
      }
    }

    const data = await response.json() as Record<string, unknown>

    if (provider === 'deepseek')
    {
      const balanceInfos = data.balance_infos as Record<string, unknown>[] | undefined
      if (balanceInfos && balanceInfos.length > 0)
      {
        const info = balanceInfos[0]
        return {
          success: true,
          quota: {
            available: Number(info.granted_balance) + Number(info.topped_up_balance),
            total: Number(info.total_balance),
            currency: (info.currency as string) || 'CNY',
            label: '可用额度'
          }
        }
      }
      return { success: false, error: '未获取到额度信息' }
    }

    if (provider === 'kimi')
    {
      const available = data.available as number | undefined
      const total = data.total as number | undefined
      if (available !== undefined)
      {
        return {
          success: true,
          quota: {
            available: Number(available),
            total: total ? Number(total) : Number(available),
            currency: 'CNY',
            label: '可用额度'
          }
        }
      }
      return { success: false, error: '未获取到额度信息' }
    }

    return { success: false, error: '该服务商暂不支持额度查询' }
  }
  catch (error: unknown)
  {
    const err = error as Error
    if (err.name === 'AbortError')
    {
      return { success: false, error: '请求超时' }
    }
    return { success: false, error: err.message || '网络错误' }
  }
})

ipcMain.handle('api-stream-abort', async (_, streamId?: string) =>
{
  if (streamId)
  {
    const controller = streamAbortControllers.get(streamId)
    if (controller)
    {
      controller.abort()
      streamAbortControllers.delete(streamId)
      mainWindow?.webContents.send('api-stream-done', { streamId })
    }
  }
  else
  {
    for (const [id, controller] of streamAbortControllers)
    {
      controller.abort()
      mainWindow?.webContents.send('api-stream-done', { streamId: id })
    }
    streamAbortControllers.clear()
  }
  return { success: true }
})

ipcMain.handle('api-stream-request', async (_, options: {
  url: string
  provider: string
  apiKey: string
  body: Record<string, unknown>
  streamId: string
}) =>
{
  const { url, provider, apiKey, body, streamId } = options

  const sendError = (status: number, errorData: unknown) =>
  {
    mainWindow?.webContents.send('api-stream-error', { status, data: errorData, streamId })
  }

  try
  {
    let finalUrl = url
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (provider === 'google')
    {
      const separator = finalUrl.includes('?') ? '&' : '?'
      finalUrl = `${finalUrl}${separator}key=${encodeURIComponent(apiKey)}`
    }
    else if (provider === 'anthropic')
    {
      headers['anthropic-version'] = '2023-06-01'
      headers['x-api-key'] = apiKey
    }
    else
    {
      headers['Authorization'] = getAuthHeader(provider, apiKey)
    }

    const abortController = new AbortController()
    streamAbortControllers.set(streamId, abortController)
    const timeoutId = setTimeout(() => abortController.abort(), 120000)

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abortController.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok)
    {
      let errorData: unknown = null
      try
      {
        errorData = await response.json()
      }
      catch
      {
        // ignore JSON parse error
      }
      streamAbortControllers.delete(streamId)
      sendError(response.status, errorData)
      return { success: false }
    }

    const reader = response.body?.getReader()
    if (!reader)
    {
      streamAbortControllers.delete(streamId)
      sendError(0, { error: { message: '获取响应流失败' } })
      return { success: false }
    }

    const decoder = new TextDecoder()
    let buffer = ''

    const extractContent = (json: Record<string, unknown>): string =>
    {
      if (provider === 'anthropic')
      {
        if (json.type === 'content_block_delta' && (json.delta as Record<string, unknown>)?.text)
        {
          return (json.delta as Record<string, unknown>).text as string
        }
        return ''
      }
      if (provider === 'google')
      {
        return ((json.candidates as Record<string, unknown>[])?.[0]?.content as Record<string, unknown>)
          ? ((((json.candidates as Record<string, unknown>[])[0]?.content as Record<string, unknown>)?.parts as Record<string, unknown>[])?.[0]?.text as string) || ''
          : ''
      }
      return (json.choices as Record<string, unknown>[])?.[0]
        ? ((json.choices as Record<string, unknown>[])[0]?.delta as Record<string, unknown>)?.content as string || ''
        : ''
    }

    const isDoneSignal = (data: string): boolean =>
    {
      if (provider === 'anthropic')
      {
        try
        {
          const json = JSON.parse(data)
          return json.type === 'message_stop'
        }
        catch
        {
          return false
        }
      }
      return data === '[DONE]'
    }

    while (true)
    {
      const { done, value } = await reader.read()
      if (done)
      {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      while (buffer.includes('\n\n'))
      {
        const idx = buffer.indexOf('\n\n')
        const block = buffer.substring(0, idx)
        buffer = buffer.substring(idx + 2)

        const dataLine = block
          .split('\n')
          .filter(l => l.startsWith('data: '))
          .map(l => l.substring(6))
          .join('')

        if (dataLine)
        {
          if (isDoneSignal(dataLine))
          {
            streamAbortControllers.delete(streamId)
            mainWindow?.webContents.send('api-stream-done', { streamId })
            return { success: true }
          }

          try
          {
            const json = JSON.parse(dataLine) as Record<string, unknown>
            if (json.error)
            {
              streamAbortControllers.delete(streamId)
              sendError(0, json)
              return { success: false }
            }
            const content = extractContent(json)
            if (content)
            {
              mainWindow?.webContents.send('api-stream-chunk', { content, streamId })
            }
          }
          catch
          {
            // skip unparseable chunks
          }
        }
      }
    }

    streamAbortControllers.delete(streamId)
    mainWindow?.webContents.send('api-stream-done', { streamId })
    return { success: true }
  }
  catch (error: unknown)
  {
    streamAbortControllers.delete(streamId)
    const err = error as Error
    if (err.name !== 'AbortError')
    {
      let message = '网络错误'
      sendError(0, { error: { message } })
    }
    return { success: false }
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

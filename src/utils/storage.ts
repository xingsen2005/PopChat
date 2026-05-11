import { ModelConfig, Conversation, AppSettings, LogEntry } from '../types'

const STORAGE_PREFIX = 'ai-chat-desktop:'

const electronAPI = window.electronAPI

const readStorage = (key: string): string =>
{
  const raw = localStorage.getItem(STORAGE_PREFIX + key)
  if (!raw)
  {
    return ''
  }
  return raw
}

const writeStorage = (key: string, content: string): boolean =>
{
  try
  {
    localStorage.setItem(STORAGE_PREFIX + key, content)
    return true
  }
  catch (error)
  {
    if (error instanceof DOMException && error.name === 'QuotaExceededError')
    {
      console.error(`存储空间不足，无法保存 ${key}`)
      return false
    }
    throw error
  }
}

const encryptApiKey = async (apiKey: string): Promise<string> =>
{
  if (!electronAPI?.safeStorageEncrypt)
  {
    return `plain:${Buffer.from(apiKey).toString('base64')}`
  }
  const result = await electronAPI.safeStorageEncrypt(apiKey)
  if (result.success)
  {
    return `encrypted:${result.data}`
  }
  return `plain:${Buffer.from(apiKey).toString('base64')}`
}

const decryptApiKey = async (encrypted: string): Promise<string> =>
{
  if (encrypted.startsWith('plain:'))
  {
    try
    {
      return Buffer.from(encrypted.substring(6), 'base64').toString('utf-8')
    }
    catch
    {
      return ''
    }
  }
  if (!encrypted.startsWith('encrypted:') || !electronAPI?.safeStorageDecrypt)
  {
    return encrypted
  }
  const base64Data = encrypted.substring(10)
  const result = await electronAPI.safeStorageDecrypt(base64Data)
  if (result.success && result.data)
  {
    return result.data
  }
  return ''
}

export const saveModels = async (models: ModelConfig[]): Promise<void> =>
{
  const encrypted = await Promise.all(
    models.map(async (model) =>
    {
      const encryptedKey = await encryptApiKey(model.apiKey)
      return { ...model, apiKey: encryptedKey }
    })
  )
  const success = writeStorage('models', JSON.stringify(encrypted))
  if (!success)
  {
    console.error('模型保存失败：存储空间不足')
  }
}

export const loadModels = async (): Promise<ModelConfig[]> =>
{
  const data = readStorage('models')
  if (!data)
  {
    return []
  }
  try
  {
    const parsed: ModelConfig[] = JSON.parse(data)
    return Promise.all(
      parsed.map(async (model) =>
      {
        const decryptedKey = await decryptApiKey(model.apiKey)
        return { ...model, apiKey: decryptedKey }
      })
    )
  }
  catch
  {
    return []
  }
}

export const saveConversations = (conversations: Conversation[]): void =>
{
  const success = writeStorage('conversations', JSON.stringify(conversations))
  if (!success)
  {
    console.error('对话保存失败：存储空间不足')
  }
}

export const loadConversations = (): Promise<Conversation[]> =>
{
  const data = readStorage('conversations')
  if (!data)
  {
    return Promise.resolve([])
  }
  try
  {
    return Promise.resolve(JSON.parse(data))
  }
  catch
  {
    return Promise.resolve([])
  }
}

export const saveSettings = (settings: AppSettings): void =>
{
  const success = writeStorage('settings', JSON.stringify(settings))
  if (!success)
  {
    console.error('设置保存失败：存储空间不足')
  }
}

export const loadSettings = (): Promise<AppSettings> =>
{
  const data = readStorage('settings')
  const defaults: AppSettings = {
    theme: 'system',
    autoUpdate: true,
    compactMode: false
  }
  if (!data)
  {
    return Promise.resolve(defaults)
  }
  try
  {
    return Promise.resolve(JSON.parse(data))
  }
  catch
  {
    return Promise.resolve(defaults)
  }
}

export const addLog = (entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> =>
{
  const logs = loadLogsSync()
  const newEntry: LogEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: Date.now()
  }
  logs.push(newEntry)
  if (logs.length > 1000)
  {
    logs.splice(0, logs.length - 1000)
  }
  writeStorage('logs', JSON.stringify(logs))
  return Promise.resolve()
}

const loadLogsSync = (): LogEntry[] =>
{
  const data = readStorage('logs')
  if (!data)
  {
    return []
  }
  try
  {
    return JSON.parse(data)
  }
  catch
  {
    return []
  }
}

export const loadLogs = (): Promise<LogEntry[]> =>
{
  return Promise.resolve(loadLogsSync())
}

export const clearAllLogs = (): Promise<void> =>
{
  writeStorage('logs', '[]')
  return Promise.resolve()
}

export const getDefaultModel = (models: ModelConfig[]): ModelConfig | null =>
{
  return models.find(m => m.isDefault && m.enabled) || models.find(m => m.enabled) || null
}

export const getModelById = (models: ModelConfig[], id: string): ModelConfig | undefined =>
{
  return models.find(m => m.id === id)
}

export { encryptApiKey, decryptApiKey }

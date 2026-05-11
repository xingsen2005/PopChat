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

const writeStorage = (key: string, content: string): void =>
{
  localStorage.setItem(STORAGE_PREFIX + key, content)
}

const encryptApiKey = async (apiKey: string): Promise<string> =>
{
  if (!electronAPI?.safeStorageEncrypt)
  {
    return apiKey
  }
  const result = await electronAPI.safeStorageEncrypt(apiKey)
  if (result.success)
  {
    return `encrypted:${result.data}`
  }
  return apiKey
}

const decryptApiKey = async (encrypted: string): Promise<string> =>
{
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
  writeStorage('models', JSON.stringify(encrypted))
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

export const saveConversations = (conversations: Conversation[]): Promise<void> =>
{
  writeStorage('conversations', JSON.stringify(conversations))
  return Promise.resolve()
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

export const saveSettings = (settings: AppSettings): Promise<void> =>
{
  writeStorage('settings', JSON.stringify(settings))
  return Promise.resolve()
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

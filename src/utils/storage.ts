import CryptoJS from 'crypto-js'
import { ModelConfig, Conversation, AppSettings, LogEntry } from '../types'

const STORAGE_PREFIX = 'ai-chat-desktop:'

const generateEncryptionKey = (): string =>
{
  const raw = [
    navigator.userAgent,
    screen.width,
    screen.height,
    navigator.language
  ].join('|')
  return CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex).substring(0, 32)
}

const ENCRYPTION_KEY = generateEncryptionKey()

const encrypt = (data: string): string =>
{
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString()
}

const decrypt = (data: string): string | null =>
{
  try
  {
    const bytes = CryptoJS.AES.decrypt(data, ENCRYPTION_KEY)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    if (!decrypted)
    {
      return null
    }
    return decrypted
  }
  catch
  {
    return null
  }
}

const readStorage = (key: string): string =>
{
  const raw = localStorage.getItem(STORAGE_PREFIX + key)
  if (!raw)
  {
    return ''
  }
  const decrypted = decrypt(raw)
  if (decrypted === null)
  {
    localStorage.removeItem(STORAGE_PREFIX + key)
    return ''
  }
  return decrypted
}

const writeStorage = (key: string, content: string): void =>
{
  localStorage.setItem(STORAGE_PREFIX + key, encrypt(content))
}

export const saveModels = async (models: ModelConfig[]): Promise<void> =>
{
  writeStorage('models', JSON.stringify(models))
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
    return JSON.parse(data)
  }
  catch
  {
    return []
  }
}

export const saveConversations = async (conversations: Conversation[]): Promise<void> =>
{
  writeStorage('conversations', JSON.stringify(conversations))
}

export const loadConversations = async (): Promise<Conversation[]> =>
{
  const data = readStorage('conversations')
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

export const saveSettings = async (settings: AppSettings): Promise<void> =>
{
  writeStorage('settings', JSON.stringify(settings))
}

export const loadSettings = async (): Promise<AppSettings> =>
{
  const data = readStorage('settings')
  if (!data)
  {
    return {
      theme: 'system',
      autoUpdate: true,
      compactMode: false
    }
  }
  try
  {
    return JSON.parse(data)
  }
  catch
  {
    return {
      theme: 'system',
      autoUpdate: true,
      compactMode: false
    }
  }
}

export const addLog = async (entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> =>
{
  const logs = await loadLogs()
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
}

export const loadLogs = async (): Promise<LogEntry[]> =>
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

export const getDefaultModel = (models: ModelConfig[]): ModelConfig | null =>
{
  return models.find(m => m.isDefault && m.enabled) || models.find(m => m.enabled) || null
}

export const getModelById = (models: ModelConfig[], id: string): ModelConfig | undefined =>
{
  return models.find(m => m.id === id)
}

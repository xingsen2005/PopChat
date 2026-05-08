export interface ModelConfig {
  id: string
  name: string
  provider: ProviderType
  apiKey: string
  modelId: string
  customEndpoint?: string
  enabled: boolean
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  filePaths?: string[]
}

export interface Conversation {
  id: string
  title: string
  modelId: string
  messages: Message[]
  createdAt: number
  updatedAt: number
}

export type ProviderType = 'deepseek' | 'google' | 'openai' | 'anthropic' | 'xai' | 'zhipu' | 'kimi' | 'volcengine'

export interface ProviderInfo {
  name: string
  defaultEndpoint: string
  modelsEndpoint?: string
}

export interface FileUpload {
  id: string
  name: string
  path: string
  size: number
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error'
  error?: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  autoUpdate: boolean
  compactMode: boolean
}

export interface LogEntry {
  id: string
  timestamp: number
  level: 'info' | 'warning' | 'error'
  message: string
  context?: string
}

export const PROVIDERS: Record<ProviderType, ProviderInfo> = {
  deepseek: {
    name: 'DeepSeek',
    defaultEndpoint: 'https://api.deepseek.com',
    modelsEndpoint: '/v1/models'
  },
  google: {
    name: 'Google',
    defaultEndpoint: 'https://generativelanguage.googleapis.com',
    modelsEndpoint: '/v1/models'
  },
  openai: {
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com',
    modelsEndpoint: '/v1/models'
  },
  anthropic: {
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com',
    modelsEndpoint: '/v1/models'
  },
  xai: {
    name: 'xAI',
    defaultEndpoint: 'https://api.x.ai',
    modelsEndpoint: '/v1/models'
  },
  zhipu: {
    name: '智谱清言',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    modelsEndpoint: '/models'
  },
  kimi: {
    name: 'Kimi',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    modelsEndpoint: '/models'
  },
  volcengine: {
    name: '火山引擎',
    defaultEndpoint: 'https://ark.cn-beijing.volces.com/api',
    modelsEndpoint: '/v3/models'
  }
}
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

export interface TokenQuota
{
  available: number
  total: number
  currency: string
  label: string
}

export interface ProviderInfo {
  name: string
  defaultEndpoint: string
  modelsEndpoint?: string
  chatEndpoint?: string
  balanceEndpoint?: string
  staticModels?: string[]
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

export interface PendingAttachment
{
  id: string
  name: string
  path: string
  size: number
  status: 'pending' | 'reading' | 'ready' | 'error'
  error?: string
  content?: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  autoUpdate: boolean
  compactMode: boolean
  lastSelectedModelId?: string
  systemPrompt?: string
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
    modelsEndpoint: '/v1/models',
    chatEndpoint: '/v1/chat/completions',
    balanceEndpoint: '/user/balance'
  },
  google: {
    name: 'Google',
    defaultEndpoint: 'https://generativelanguage.googleapis.com',
    modelsEndpoint: '/v1/models',
    chatEndpoint: '/v1/models/{modelId}:generateContent'
  },
  openai: {
    name: 'OpenAI',
    defaultEndpoint: 'https://api.openai.com',
    modelsEndpoint: '/v1/models',
    chatEndpoint: '/v1/chat/completions'
  },
  anthropic: {
    name: 'Anthropic',
    defaultEndpoint: 'https://api.anthropic.com',
    chatEndpoint: '/v1/messages',
    staticModels: [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307'
    ]
  },
  xai: {
    name: 'xAI',
    defaultEndpoint: 'https://api.x.ai',
    modelsEndpoint: '/v1/models',
    chatEndpoint: '/v1/chat/completions'
  },
  zhipu: {
    name: '智谱清言',
    defaultEndpoint: 'https://open.bigmodel.cn/api/paas/v4',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions'
  },
  kimi: {
    name: 'Kimi',
    defaultEndpoint: 'https://api.moonshot.cn/v1',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions',
    balanceEndpoint: '/users/me/balance'
  },
  volcengine: {
    name: '火山引擎',
    defaultEndpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    modelsEndpoint: '/models',
    chatEndpoint: '/chat/completions'
  }
}
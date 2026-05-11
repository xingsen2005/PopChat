import { ModelConfig, Message, PROVIDERS, TokenQuota } from '../types'

export interface APIError
{
  code: string
  message: string
  details?: unknown
}

const parseAPIError = (status: number, data: unknown): APIError =>
{
  const errorData = (data as Record<string, unknown>)?.error as Record<string, unknown> | undefined

  if (status === 401)
  {
    return {
      code: 'UNAUTHORIZED',
      message: (errorData?.message as string) || 'API 密钥无效或认证失败'
    }
  }

  if (status === 403)
  {
    return {
      code: 'FORBIDDEN',
      message: (errorData?.message as string) || '访问被拒绝'
    }
  }

  if (status === 429)
  {
    return {
      code: 'RATE_LIMITED',
      message: (errorData?.message as string) || '请求频率超限，请稍后重试'
    }
  }

  if (status >= 500)
  {
    return {
      code: 'SERVER_ERROR',
      message: (errorData?.message as string) || '服务器错误，请稍后重试'
    }
  }

  if (status === 0)
  {
    return {
      code: 'NETWORK_ERROR',
      message: (errorData?.message as string) || '网络错误'
    }
  }

  return {
    code: `HTTP_${status}`,
    message: (errorData?.message as string) || `请求失败，状态码 ${status}`,
    details: data
  }
}

export const fetchTokenQuota = async (model: ModelConfig): Promise<{
  success: boolean
  quota?: TokenQuota
  error?: string
}> =>
{
  const provider = PROVIDERS[model.provider]

  if (!provider.balanceEndpoint)
  {
    return {
      success: false,
      error: '该服务商暂不支持额度查询'
    }
  }

  const baseURL = model.customEndpoint || provider.defaultEndpoint

  try
  {
    const result = await window.electronAPI.fetchTokenQuota({
      provider: model.provider,
      apiKey: model.apiKey,
      baseURL,
      balanceEndpoint: provider.balanceEndpoint
    })

    if (result.success && result.quota)
    {
      return {
        success: true,
        quota: result.quota
      }
    }

    return {
      success: false,
      error: result.error || '获取额度失败'
    }
  }
  catch (error)
  {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

export const fetchModels = async (model: ModelConfig): Promise<{ success: boolean; data: string[]; error?: APIError }> =>
{
  const provider = PROVIDERS[model.provider]

  if (provider.staticModels)
  {
    return { success: true, data: provider.staticModels }
  }

  const baseURL = model.customEndpoint || provider.defaultEndpoint
  const modelsEndpoint = provider.modelsEndpoint || '/v1/models'
  const url = `${baseURL}${modelsEndpoint}`

  try
  {
    const result = await window.electronAPI.apiRequest({
      url,
      method: 'GET',
      provider: model.provider,
      apiKey: model.apiKey
    })

    if (!result.ok)
    {
      if (result.error)
      {
        return { success: false, data: [], error: result.error as APIError }
      }
      return { success: false, data: [], error: parseAPIError(result.status, result.data) }
    }

    const response = result.data as Record<string, unknown>
    let modelList: string[] = []

    switch (model.provider)
    {
      case 'openai':
      case 'deepseek':
      case 'xai':
        modelList = (response?.data as Record<string, unknown>[])?.map((m) => m.id as string) || []
        break
      case 'google':
        modelList = (response?.models as Record<string, unknown>[])?.map((m) => (m.name as string).replace(/^models\//, '')) || []
        break
      case 'zhipu':
        modelList = (response?.data as Record<string, unknown>[])?.map((m) => m.model_name as string) || []
        break
      case 'kimi':
        modelList = (response?.data as Record<string, unknown>[])?.map((m) => m.id as string) || []
        break
      case 'volcengine':
        modelList = (response?.data as Record<string, unknown>[])?.map((m) => m.id as string) || []
        break
    }

    return { success: true, data: modelList }
  }
  catch (error)
  {
    return {
      success: false,
      data: [],
      error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : '未知错误' }
    }
  }
}

export const abortStream = (streamId?: string): void =>
{
  window.electronAPI.apiStreamAbort(streamId)
}

const buildChatUrl = (model: ModelConfig, stream: boolean = false, apiKey?: string): string =>
{
  const provider = PROVIDERS[model.provider]
  const baseURL = model.customEndpoint || provider.defaultEndpoint
  const chatPath = provider.chatEndpoint || '/v1/chat/completions'
  const resolvedPath = chatPath.replace('{modelId}', model.modelId)

  if (model.provider === 'google' && stream)
  {
    const streamPath = resolvedPath.replace(':generateContent', ':streamGenerateContent')
    const keyParam = apiKey ? `&key=${encodeURIComponent(apiKey)}` : ''
    return `${baseURL}${streamPath}?alt=sse${keyParam}`
  }

  return `${baseURL}${resolvedPath}`
}

const buildRequestBody = (model: ModelConfig, messages: Message[], stream: boolean): Record<string, unknown> =>
{
  if (model.provider === 'anthropic')
  {
    const systemMessage = messages.find(m => m.role === 'system')
    const chatMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: m.content
      }))

    if (chatMessages.length > 0 && chatMessages[0].role !== 'user')
    {
      chatMessages.unshift({ role: 'user', content: ' ' })
    }

    return {
      model: model.modelId,
      max_tokens: 8192,
      stream,
      ...(systemMessage ? { system: systemMessage.content } : {}),
      messages: chatMessages
    }
  }

  if (model.provider === 'google')
  {
    return {
      model: model.modelId,
      contents: messages
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
      ...(messages.find(m => m.role === 'system')
        ? { systemInstruction: { parts: [{ text: messages.find(m => m.role === 'system')!.content }] } }
        : {})
    }
  }

  return {
    model: model.modelId,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    })),
    stream
  }
}

export const sendMessage = async (
  model: ModelConfig,
  messages: Message[],
  onChunk: (chunk: string) => void,
  onError: (error: APIError) => void,
  streamId: string
): Promise<void> =>
{
  const url = buildChatUrl(model, true, model.apiKey)
  const handlers: { chunk?: unknown; error?: unknown; done?: unknown } = {}

  try
  {
    await new Promise<void>((resolve) =>
    {
      handlers.chunk = window.electronAPI.onApiStreamChunk((data: { content: string; streamId: string }) =>
      {
        if (data.streamId === streamId)
        {
          onChunk(data.content)
        }
      })

      handlers.error = window.electronAPI.onApiStreamError((data: { status: number; data: unknown; streamId: string }) =>
      {
        if (data.streamId === streamId)
        {
          onError(parseAPIError(data.status, data.data))
          window.electronAPI.removeApiStreamListeners(handlers)
          resolve()
        }
      })

      handlers.done = window.electronAPI.onApiStreamDone((data: { streamId: string }) =>
      {
        if (data.streamId === streamId)
        {
          window.electronAPI.removeApiStreamListeners(handlers)
          resolve()
        }
      })

      window.electronAPI.apiStreamRequest({
        url,
        provider: model.provider,
        apiKey: model.apiKey,
        body: buildRequestBody(model, messages, true),
        streamId
      })
    })
  }
  finally
  {
    window.electronAPI.removeApiStreamListeners(handlers)
  }
}

export const sendMessageNonStream = async (
  model: ModelConfig,
  messages: Message[]
): Promise<{ success: boolean; content: string; error?: APIError }> =>
{
  const url = buildChatUrl(model, false, model.apiKey)

  try
  {
    const result = await window.electronAPI.apiRequest({
      url,
      method: 'POST',
      provider: model.provider,
      apiKey: model.apiKey,
      body: buildRequestBody(model, messages, false)
    })

    if (!result.ok)
    {
      if (result.error)
      {
        return { success: false, content: '', error: result.error as APIError }
      }
      return { success: false, content: '', error: parseAPIError(result.status, result.data) }
    }

    const responseData = result.data as Record<string, unknown>
    let content = ''

    if (model.provider === 'anthropic')
    {
      content = (responseData?.content as Record<string, unknown>[])?.[0]?.text as string || ''
    }
    else if (model.provider === 'google')
    {
      content = (responseData?.candidates as Record<string, unknown>[])?.[0]?.content as Record<string, unknown>
        ? (((responseData?.candidates as Record<string, unknown>[])[0]?.content as Record<string, unknown>)?.parts as Record<string, unknown>[])?.[0]?.text as string || ''
        : ''
    }
    else
    {
      const choices = responseData?.choices as Record<string, unknown>[] | undefined
      content = (choices?.[0]?.message as Record<string, unknown>)?.content as string || ''
    }

    return { success: true, content }
  }
  catch (error)
  {
    return {
      success: false,
      content: '',
      error: { code: 'UNKNOWN', message: error instanceof Error ? error.message : '未知错误' }
    }
  }
}

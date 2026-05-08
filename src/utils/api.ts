import axios, { AxiosError } from 'axios'
import { ModelConfig, Message, PROVIDERS } from '../types'

const createClient = (model: ModelConfig) =>
{
  const provider = PROVIDERS[model.provider]
  const baseURL = model.customEndpoint || provider.defaultEndpoint

  return axios.create({
    baseURL,
    headers: {
      'Authorization': `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json'
    },
    timeout: 120000
  })
}

export interface APIError
{
  code: string
  message: string
  details?: unknown
}

const parseAxiosError = (error: unknown): APIError =>
{
  if (axios.isAxiosError(error))
  {
    const axiosError = error as AxiosError

    if (axiosError.code === 'ECONNABORTED')
    {
      return { code: 'TIMEOUT', message: '请求超时' }
    }

    if (axiosError.code === 'ERR_NETWORK')
    {
      return { code: 'NETWORK_ERROR', message: '网络错误' }
    }

    if (axiosError.response)
    {
      const status = axiosError.response.status
      const data = axiosError.response.data as Record<string, unknown> | undefined
      const errorData = data?.error as Record<string, unknown> | undefined

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

      return {
        code: `HTTP_${status}`,
        message: (errorData?.message as string) || `请求失败，状态码 ${status}`,
        details: data
      }
    }

    return {
      code: 'UNKNOWN',
      message: axiosError.message || '未知错误'
    }
  }

  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : '未知错误'
  }
}

const parseFetchError = (error: unknown): APIError =>
{
  if (error instanceof TypeError && error.message.includes('Failed to fetch'))
  {
    return { code: 'NETWORK_ERROR', message: '网络错误' }
  }
  return {
    code: 'UNKNOWN',
    message: error instanceof Error ? error.message : '未知错误'
  }
}

export const fetchModels = async (model: ModelConfig): Promise<{ success: boolean; data: string[]; error?: APIError }> =>
{
  const provider = PROVIDERS[model.provider]
  const client = createClient(model)

  try
  {
    const response = await client.get(provider.modelsEndpoint || '/v1/models')

    let result: string[] = []
    switch (model.provider)
    {
      case 'openai':
      case 'deepseek':
      case 'xai':
        result = response.data.data.map((m: Record<string, unknown>) => m.id as string)
        break
      case 'anthropic':
        result = response.data.models.map((m: Record<string, unknown>) => m.name as string)
        break
      case 'google':
        result = response.data.models.map((m: Record<string, unknown>) => m.name as string)
        break
      case 'zhipu':
        result = response.data.data.map((m: Record<string, unknown>) => m.model_name as string)
        break
      case 'kimi':
        result = response.data.data.map((m: Record<string, unknown>) => m.id as string)
        break
      case 'volcengine':
        result = response.data.models.map((m: Record<string, unknown>) => m.name as string)
        break
    }

    return { success: true, data: result }
  }
  catch (error)
  {
    return { success: false, data: [], error: parseAxiosError(error) }
  }
}

export const sendMessage = async (
  model: ModelConfig,
  messages: Message[],
  onChunk: (chunk: string) => void,
  onError: (error: APIError) => void
): Promise<void> =>
{
  const provider = PROVIDERS[model.provider]
  const baseURL = model.customEndpoint || provider.defaultEndpoint
  const url = `${baseURL}/v1/chat/completions`

  try
  {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${model.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content
        })),
        stream: true
      })
    })

    if (!response.ok)
    {
      let errorData: Record<string, unknown> | null = null
      try
      {
        errorData = await response.json() as Record<string, unknown>
      }
      catch
      {
        // ignore parse error
      }

      const errorObj = errorData?.error as Record<string, unknown> | undefined
      const status = response.status

      if (status === 401)
      {
        onError({ code: 'UNAUTHORIZED', message: (errorObj?.message as string) || 'API 密钥无效' })
        return
      }
      if (status === 429)
      {
        onError({ code: 'RATE_LIMITED', message: (errorObj?.message as string) || '请求频率超限' })
        return
      }
      if (status >= 500)
      {
        onError({ code: 'SERVER_ERROR', message: (errorObj?.message as string) || '服务器错误' })
        return
      }

      onError({
        code: `HTTP_${status}`,
        message: (errorObj?.message as string) || `请求失败，状态码 ${status}`
      })
      return
    }

    const reader = response.body?.getReader()
    if (!reader)
    {
      onError({ code: 'STREAM_ERROR', message: '获取响应流失败' })
      return
    }

    const decoder = new TextDecoder()
    let buffer = ''

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
        const line = buffer.substring(0, idx)
        buffer = buffer.substring(idx + 2)

        if (line.startsWith('data: '))
        {
          const data = line.substring(6)
          if (data === '[DONE]')
          {
            return
          }

          try
          {
            const json = JSON.parse(data)

            if (json.error)
            {
              onError({
                code: 'API_ERROR',
                message: json.error.message || 'API error occurred',
                details: json.error
              })
              return
            }

            const content = json.choices?.[0]?.delta?.content || ''
            if (content)
            {
              onChunk(content)
            }
          }
          catch
          {
            // skip unparseable chunks
          }
        }
      }
    }
  }
  catch (error)
  {
    onError(parseFetchError(error))
  }
}

export const sendMessageNonStream = async (
  model: ModelConfig,
  messages: Message[]
): Promise<{ success: boolean; content: string; error?: APIError }> =>
{
  const client = createClient(model)

  try
  {
    const response = await client.post('/v1/chat/completions', {
      model: model.modelId,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      })),
      stream: false
    })

    return {
      success: true,
      content: response.data.choices?.[0]?.message?.content || ''
    }
  }
  catch (error)
  {
    return { success: false, content: '', error: parseAxiosError(error) }
  }
}

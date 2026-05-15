import { useState, useEffect, useCallback, useRef } from 'react'
import { ModelConfig, Conversation, Message, AppSettings, PROVIDERS, ProviderType, PendingAttachment } from './types'
import { loadModels, saveModels, loadConversations, saveConversations, loadSettings, saveSettings, getDefaultModel, getModelById, addLog } from './utils/storage'
import { sendMessage, abortStream } from './utils/api'
import { v4 as uuidv4 } from 'uuid'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import ModelConfigModal from './components/ModelConfigModal'
import ModelManagement from './components/ModelManagement'
import SettingsPanel from './components/SettingsPanel'
import { Settings, MessageSquare } from 'lucide-react'

const debounce = <T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T =>
{
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  return ((...args: Parameters<T>) =>
  {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T
}

type ViewType = 'chat' | 'models' | 'settings'

function App()
{
  const [models, setModels] = useState<ModelConfig[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [currentModel, setCurrentModel] = useState<ModelConfig | null>(null)
  const [view, setView] = useState<ViewType>('chat')
  const [isModelConfigOpen, setIsModelConfigOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)
  const [settings, setSettings] = useState<AppSettings>({ theme: 'system', autoUpdate: true, compactMode: false })
  const [loadingConversations, setLoadingConversations] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string>('')

  const debouncedSaveModels = useRef(debounce(saveModels, 1000)).current
  const debouncedSaveConversations = useRef(debounce(saveConversations, 1000)).current
  const debouncedSaveSettings = useRef(debounce(saveSettings, 1000)).current

  const streamingContentMap = useRef<Map<string, string>>(new Map())
  const currentConversationRef = useRef<Conversation | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const applyTheme = (theme: AppSettings['theme']) =>
  {
    const root = document.documentElement
    if (theme === 'system')
    {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', systemDark)
    }
    else
    {
      root.classList.toggle('dark', theme === 'dark')
    }
  }

  const createNewConversation = useCallback(() =>
  {
    const newConversation: Conversation = {
      id: uuidv4(),
      title: '新对话',
      modelId: currentModel?.id || '',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    setConversations(prev => [newConversation, ...prev])
    setCurrentConversation(newConversation)
    setView('chat')
  }, [currentModel?.id])

  useEffect(() =>
  {
    currentConversationRef.current = currentConversation
  }, [currentConversation])

  useEffect(() =>
  {
    if (error)
    {
      if (errorTimeoutRef.current)
      {
        clearTimeout(errorTimeoutRef.current)
      }
      const autoDismissErrors = ['NETWORK_ERROR', 'TIMEOUT', 'RATE_LIMITED', 'HTTP_']
      const shouldAutoDismiss = autoDismissErrors.some(e => error.startsWith(e))
      if (shouldAutoDismiss)
      {
        errorTimeoutRef.current = setTimeout(() =>
        {
          setError('')
        }, 5000)
      }
    }
    return () =>
    {
      if (errorTimeoutRef.current)
      {
        clearTimeout(errorTimeoutRef.current)
      }
    }
  }, [error])

  useEffect(() =>
  {
    const handleKeyDown = (e: KeyboardEvent) =>
    {
      if (e.ctrlKey || e.metaKey)
      {
        if (e.key === 'n' || e.key === 'N')
        {
          e.preventDefault()
          createNewConversation()
        }
        else if (e.key === 'm' || e.key === 'M')
        {
          e.preventDefault()
          setView(view === 'models' ? 'chat' : 'models')
        }
        else if (e.key === ',' || e.key === '<')
        {
          e.preventDefault()
          setView(view === 'settings' ? 'chat' : 'settings')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [createNewConversation, view])

  useEffect(() =>
  {
    const loadData = async () =>
    {
      try
      {
        const [loadedModels, loadedConversations, loadedSettings] = await Promise.all([
          loadModels(),
          loadConversations(),
          loadSettings()
        ])

        setModels(loadedModels)

        let selectedModel: ModelConfig | null = null
        if (loadedSettings.lastSelectedModelId)
        {
          selectedModel = getModelById(loadedModels, loadedSettings.lastSelectedModelId) || null
          if (selectedModel && !selectedModel.enabled)
          {
            selectedModel = null
          }
        }
        if (!selectedModel)
        {
          selectedModel = getDefaultModel(loadedModels)
        }
        setCurrentModel(selectedModel)

        setConversations(loadedConversations)
        if (loadedConversations.length > 0)
        {
          setCurrentConversation(loadedConversations[0])
        }

        setSettings(loadedSettings)
        applyTheme(loadedSettings.theme)
      }
      catch (error)
      {
        addLog({ level: 'error', message: `加载数据失败：${error instanceof Error ? error.message : '未知错误'}`, context: 'App' })
      }
    }
    loadData()
  }, [])

  useEffect(() =>
  {
    debouncedSaveModels(models)
  }, [models, debouncedSaveModels])

  useEffect(() =>
  {
    debouncedSaveConversations(conversations)
  }, [conversations, debouncedSaveConversations])

  useEffect(() =>
  {
    debouncedSaveSettings(settings)
    applyTheme(settings.theme)
  }, [settings, debouncedSaveSettings])

  useEffect(() =>
  {
    if (settings.theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () =>
    {
      const root = document.documentElement
      root.classList.toggle('dark', mediaQuery.matches)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settings.theme])

  const deleteConversation = useCallback((id: string) =>
  {
    setConversations(prev =>
    {
      const remaining = prev.filter(c => c.id !== id)
      if (currentConversation?.id === id)
      {
        setCurrentConversation(remaining.length > 0 ? remaining[0] : null)
      }
      return remaining
    })
    setLoadingConversations(prev =>
    {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [currentConversation?.id])

  const selectConversation = useCallback((conversation: Conversation) =>
  {
    setCurrentConversation(conversation)
    setView('chat')
    const targetModel = models.find(m => m.id === conversation.modelId && m.enabled)
    if (targetModel && targetModel.id !== currentModel?.id)
    {
      setCurrentModel(targetModel)
    }
  }, [models, currentModel?.id])

  const renameConversation = useCallback((id: string, title: string) =>
  {
    setConversations(prev => prev.map(c =>
      c.id === id ? { ...c, title, updatedAt: Date.now() } : c
    ))
    setCurrentConversation(prev =>
      prev?.id === id ? { ...prev, title, updatedAt: Date.now() } : prev
    )
  }, [])

  const selectModel = useCallback((model: ModelConfig) =>
  {
    setCurrentModel(model)
    setSettings(prev => ({ ...prev, lastSelectedModelId: model.id }))
  }, [])

  const addMessageToConversation = useCallback((conversationId: string, message: Message) =>
  {
    setConversations(prev => prev.map(c =>
    {
      if (c.id !== conversationId) return c
      const updatedMessages = [...c.messages, message]
      return {
        ...c,
        messages: updatedMessages,
        updatedAt: Date.now(),
        title: c.messages.length === 0 ? message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '') : c.title
      }
    }))

    setCurrentConversation(prev =>
    {
      if (!prev || prev.id !== conversationId) return prev
      const updatedMessages = [...prev.messages, message]
      return {
        ...prev,
        messages: updatedMessages,
        updatedAt: Date.now(),
        title: prev.messages.length === 0 ? message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '') : prev.title
      }
    })
  }, [])

  const updateMessageInConversation = useCallback((conversationId: string, messageId: string, content: string) =>
  {
    setConversations(prev => prev.map(c =>
    {
      if (c.id !== conversationId) return c
      return {
        ...c,
        messages: c.messages.map(m =>
          m.id === messageId ? { ...m, content } : m
        )
      }
    }))

    setCurrentConversation(prev =>
    {
      if (!prev || prev.id !== conversationId) return prev
      return {
        ...prev,
        messages: prev.messages.map(m =>
          m.id === messageId ? { ...m, content } : m
        )
      }
    })
  }, [])

  const buildApiContent = (text: string, attachments: PendingAttachment[]): string =>
  {
    if (attachments.length === 0) return text

    const parts: string[] = []

    if (text.trim())
    {
      parts.push(text.trim())
    }

    for (const attachment of attachments)
    {
      if (attachment.content)
      {
        parts.push(`[附件：${attachment.name}]\n${attachment.content}`)
      }
    }

    return parts.join('\n\n')
  }

  const getEffectiveSystemPrompt = useCallback((modelId: string): string | undefined =>
  {
    const modelPrompt = settings.modelSystemPrompts?.[modelId]
    if (modelPrompt !== undefined)
    {
      return modelPrompt || undefined
    }
    return settings.systemPrompt || undefined
  }, [settings.systemPrompt, settings.modelSystemPrompts])

  const getEffectivePromptSource = useCallback((modelId: string): 'model' | 'global' | 'none' =>
  {
    if (settings.modelSystemPrompts?.[modelId] !== undefined) return 'model'
    if (settings.systemPrompt) return 'global'
    return 'none'
  }, [settings.systemPrompt, settings.modelSystemPrompts])

  const sendChatMessage = useCallback(async (content: string, attachments: PendingAttachment[] = []) =>
  {
    if (!currentModel) return
    if (!content.trim() && attachments.length === 0) return

    const conversationId = currentConversationRef.current?.id
    if (!conversationId) return

    setLoadingConversations(prev => new Set(prev).add(conversationId))
    setError('')

    const filePaths = attachments.map(a => a.path)

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      filePaths: filePaths.length > 0 ? filePaths : undefined
    }

    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    addMessageToConversation(conversationId, userMessage)
    addMessageToConversation(conversationId, assistantMessage)

    streamingContentMap.current.set(conversationId, '')

    const apiMessage: Message = {
      ...userMessage,
      content: buildApiContent(content.trim(), attachments)
    }

    const baseMessages = [...(currentConversationRef.current?.messages || []), apiMessage]

    const messagesSnapshot: Message[] = []

    const effectivePrompt = getEffectiveSystemPrompt(currentModel.id)
    if (effectivePrompt)
    {
      messagesSnapshot.push({
        id: uuidv4(),
        role: 'system',
        content: effectivePrompt,
        timestamp: Date.now()
      })
    }

    messagesSnapshot.push(...baseMessages)

    try
    {
      await sendMessage(
        currentModel,
        messagesSnapshot,
        (chunk) =>
        {
          const current = streamingContentMap.current.get(conversationId) || ''
          const updated = current + chunk
          streamingContentMap.current.set(conversationId, updated)
          updateMessageInConversation(conversationId, assistantMessage.id, updated)
        },
        (apiError) =>
        {
          const errorMessage = `${apiError.code}: ${apiError.message}`
          setError(errorMessage)
          addLog({ level: 'error', message: errorMessage, context: 'API' })
        },
        conversationId
      )
    }
    catch (err)
    {
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      setError(errorMessage)
      addLog({ level: 'error', message: errorMessage, context: 'API' })
    }
    finally
    {
      setLoadingConversations(prev =>
      {
        const next = new Set(prev)
        next.delete(conversationId)
        return next
      })
      streamingContentMap.current.delete(conversationId)
    }
  }, [currentModel, addMessageToConversation, updateMessageInConversation, getEffectiveSystemPrompt])

  const stopGeneration = useCallback((conversationId?: string) =>
  {
    if (conversationId)
    {
      abortStream(conversationId)
      setLoadingConversations(prev =>
      {
        const next = new Set(prev)
        next.delete(conversationId)
        return next
      })
      streamingContentMap.current.delete(conversationId)
    }
    else
    {
      abortStream()
      setLoadingConversations(new Set())
      streamingContentMap.current.clear()
    }
  }, [])

  const deleteMessage = useCallback((messageId: string) =>
  {
    setCurrentConversation(prev =>
    {
      if (!prev) return prev

      const updatedMessages = prev.messages.filter(m => m.id !== messageId)
      const updatedConversation: Conversation = {
        ...prev,
        messages: updatedMessages,
        updatedAt: Date.now()
      }

      setConversations(convos => convos.map(c => c.id === prev.id ? updatedConversation : c))
      return updatedConversation
    })
  }, [])

  const editAndResendMessage = useCallback(async (messageId: string, newContent: string) =>
  {
    if (!currentModel || !newContent.trim()) return

    const conversationId = currentConversationRef.current?.id
    if (!conversationId) return

    let messagesToSend: Message[] = []

    setCurrentConversation(prev =>
    {
      if (!prev) return prev

      const messageIndex = prev.messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return prev

      const updatedMessages = prev.messages.slice(0, messageIndex)
      const editedMessage: Message = {
        ...prev.messages[messageIndex],
        content: newContent.trim(),
        timestamp: Date.now()
      }
      updatedMessages.push(editedMessage)

      messagesToSend = [...updatedMessages]

      const updatedConversation: Conversation = {
        ...prev,
        messages: updatedMessages,
        updatedAt: Date.now()
      }

      setConversations(convos => convos.map(c => c.id === prev.id ? updatedConversation : c))
      return updatedConversation
    })

    setLoadingConversations(prev => new Set(prev).add(conversationId))
    setError('')

    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    addMessageToConversation(conversationId, assistantMessage)

    streamingContentMap.current.set(conversationId, '')

    const finalMessages: Message[] = []

    const editEffectivePrompt = getEffectiveSystemPrompt(currentModel.id)
    if (editEffectivePrompt)
    {
      finalMessages.push({
        id: uuidv4(),
        role: 'system',
        content: editEffectivePrompt,
        timestamp: Date.now()
      })
    }
    finalMessages.push(...messagesToSend)

    try
    {
      await sendMessage(
        currentModel,
        finalMessages,
        (chunk) =>
        {
          const current = streamingContentMap.current.get(conversationId) || ''
          const updated = current + chunk
          streamingContentMap.current.set(conversationId, updated)
          updateMessageInConversation(conversationId, assistantMessage.id, updated)
        },
        (apiError) =>
        {
          const errorMessage = `${apiError.code}: ${apiError.message}`
          setError(errorMessage)
          addLog({ level: 'error', message: errorMessage, context: 'API' })
        },
        conversationId
      )
    }
    catch (err)
    {
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      setError(errorMessage)
      addLog({ level: 'error', message: errorMessage, context: 'API' })
    }
    finally
    {
      setLoadingConversations(prev =>
      {
        const next = new Set(prev)
        next.delete(conversationId)
        return next
      })
      streamingContentMap.current.delete(conversationId)
    }
  }, [currentModel, addMessageToConversation, updateMessageInConversation, getEffectiveSystemPrompt])

  const regenerateMessage = useCallback(async (messageId: string) =>
  {
    if (!currentModel) return

    const conversationId = currentConversationRef.current?.id
    if (!conversationId) return

    let messagesToSend: Message[] = []

    setCurrentConversation(prev =>
    {
      if (!prev) return prev

      const messageIndex = prev.messages.findIndex(m => m.id === messageId)
      if (messageIndex === -1) return prev

      const updatedMessages = prev.messages.slice(0, messageIndex)
      messagesToSend = [...updatedMessages]

      const updatedConversation: Conversation = {
        ...prev,
        messages: updatedMessages,
        updatedAt: Date.now()
      }

      setConversations(convos => convos.map(c => c.id === prev.id ? updatedConversation : c))
      return updatedConversation
    })

    setLoadingConversations(prev => new Set(prev).add(conversationId))
    setError('')

    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    addMessageToConversation(conversationId, assistantMessage)

    streamingContentMap.current.set(conversationId, '')

    const finalMessages: Message[] = []

    const regenEffectivePrompt = getEffectiveSystemPrompt(currentModel.id)
    if (regenEffectivePrompt)
    {
      finalMessages.push({
        id: uuidv4(),
        role: 'system',
        content: regenEffectivePrompt,
        timestamp: Date.now()
      })
    }
    finalMessages.push(...messagesToSend)

    try
    {
      await sendMessage(
        currentModel,
        finalMessages,
        (chunk) =>
        {
          const current = streamingContentMap.current.get(conversationId) || ''
          const updated = current + chunk
          streamingContentMap.current.set(conversationId, updated)
          updateMessageInConversation(conversationId, assistantMessage.id, updated)
        },
        (apiError) =>
        {
          const errorMessage = `${apiError.code}: ${apiError.message}`
          setError(errorMessage)
          addLog({ level: 'error', message: errorMessage, context: 'API' })
        },
        conversationId
      )
    }
    catch (err)
    {
      const errorMessage = err instanceof Error ? err.message : '未知错误'
      setError(errorMessage)
      addLog({ level: 'error', message: errorMessage, context: 'API' })
    }
    finally
    {
      setLoadingConversations(prev =>
      {
        const next = new Set(prev)
        next.delete(conversationId)
        return next
      })
      streamingContentMap.current.delete(conversationId)
    }
  }, [currentModel, addMessageToConversation, updateMessageInConversation, getEffectiveSystemPrompt])

  const addModel = useCallback((model: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>) =>
  {
    const newModel: ModelConfig = {
      ...model,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    if (newModel.isDefault)
    {
      setModels(prev => prev.map(m => ({ ...m, isDefault: false })))
    }

    setModels(prev => [...prev, newModel])

    if (!currentModel)
    {
      setCurrentModel(newModel)
      setSettings(prev => ({ ...prev, lastSelectedModelId: newModel.id }))
    }

    setIsModelConfigOpen(false)
    addLog({ level: 'info', message: `已添加模型：${model.name}`, context: '模型管理' })
  }, [currentModel])

  const updateModel = useCallback((id: string, updates: Partial<ModelConfig>) =>
  {
    setModels(prev => prev.map(m =>
    {
      if (m.id === id)
      {
        if (updates.isDefault && updates.isDefault === true)
        {
          return { ...m, ...updates, isDefault: true, updatedAt: Date.now() }
        }
        return { ...m, ...updates, updatedAt: Date.now() }
      }
      if (updates.isDefault && updates.isDefault === true)
      {
        return { ...m, isDefault: false }
      }
      return m
    }))
    setEditingModel(null)
    setIsModelConfigOpen(false)
    addLog({ level: 'info', message: `已更新模型：${id}`, context: '模型管理' })
  }, [])

  const deleteModel = useCallback((id: string) =>
  {
    setModels(prev =>
    {
      const remaining = prev.filter(m => m.id !== id)
      if (currentModel?.id === id)
      {
        setCurrentModel(getDefaultModel(remaining))
      }
      return remaining
    })
    const newDefaultModel = models.find(m => m.id !== id && m.enabled) || null
    if (newDefaultModel)
    {
      setConversations(prev => prev.map(c =>
        c.modelId === id ? { ...c, modelId: newDefaultModel.id } : c
      ))
    }
    addLog({ level: 'info', message: `已删除模型：${id}`, context: '模型管理' })
  }, [currentModel?.id, models])

  const setDefaultModel = useCallback((id: string) =>
  {
    setModels(prev =>
    {
      const updated = prev.map(m => ({
        ...m,
        isDefault: m.id === id,
        updatedAt: m.id === id ? Date.now() : m.updatedAt
      }))
      const model = updated.find(m => m.id === id)
      if (model)
      {
        setCurrentModel(model)
      }
      return updated
    })
    addLog({ level: 'info', message: `已设为默认模型：${id}`, context: '模型管理' })
  }, [])

  const toggleModelEnabled = useCallback((id: string) =>
  {
    setModels(prev => prev.map(m =>
    {
      if (m.id === id)
      {
        const newEnabled = !m.enabled
        if (!newEnabled && m.isDefault)
        {
          return { ...m, enabled: false, isDefault: false, updatedAt: Date.now() }
        }
        return { ...m, enabled: newEnabled, updatedAt: Date.now() }
      }
      return m
    }))
  }, [])

  const reorderModels = useCallback((reordered: ModelConfig[]) =>
  {
    setModels(reordered)
  }, [])

  const handleEditModel = useCallback((model: ModelConfig) =>
  {
    setEditingModel(model)
    setIsModelConfigOpen(true)
  }, [])

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) =>
  {
    setSettings(prev => ({ ...prev, ...newSettings }))
  }, [])

  const isCurrentConversationLoading = currentConversation
    ? loadingConversations.has(currentConversation.id)
    : false

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
      <Sidebar
        conversations={conversations}
        currentConversation={currentConversation}
        onNewConversation={createNewConversation}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        currentModel={currentModel}
        models={models}
        onSelectModel={selectModel}
        onViewChange={setView}
        currentView={view}
        settings={settings}
        getEffectivePromptSource={getEffectivePromptSource}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'chat' && (
          <ChatArea
            conversation={currentConversation}
            currentModel={currentModel}
            onSendMessage={sendChatMessage}
            isLoading={isCurrentConversationLoading}
            error={error}
            onClearError={() => setError('')}
            onStopGeneration={() => stopGeneration(currentConversation?.id)}
            onDeleteMessage={deleteMessage}
            onEditAndResend={editAndResendMessage}
            onRegenerate={regenerateMessage}
            promptSource={currentModel ? getEffectivePromptSource(currentModel.id) : 'none'}
          />
        )}

        {view === 'models' && (
          <ModelManagement
            models={models}
            onAddModel={() => { setEditingModel(null); setIsModelConfigOpen(true) }}
            onEditModel={handleEditModel}
            onDeleteModel={deleteModel}
            onSetDefault={setDefaultModel}
            onToggleEnabled={toggleModelEnabled}
            onReorderModels={reorderModels}
          />
        )}

        {view === 'settings' && (
          <SettingsPanel
            settings={settings}
            onUpdateSettings={updateSettings}
            models={models}
          />
        )}
      </div>

      {isModelConfigOpen && (
        <ModelConfigModal
          model={editingModel}
          providers={PROVIDERS}
          onSave={editingModel ? (m) => updateModel(editingModel.id, m) : addModel}
          onCancel={() => { setIsModelConfigOpen(false); setEditingModel(null) }}
        />
      )}
    </div>
  )
}

export default App

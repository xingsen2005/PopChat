import { useState, useEffect, useCallback, useRef } from 'react'
import { ModelConfig, Conversation, Message, AppSettings, PROVIDERS, ProviderType } from './types'
import { loadModels, saveModels, loadConversations, saveConversations, loadSettings, saveSettings, getDefaultModel, addLog } from './utils/storage'
import { sendMessage } from './utils/api'
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const debouncedSaveModels = useRef(debounce(saveModels, 1000)).current
  const debouncedSaveConversations = useRef(debounce(saveConversations, 1000)).current
  const debouncedSaveSettings = useRef(debounce(saveSettings, 1000)).current

  const streamingContentRef = useRef<string>('')

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
        const defaultModel = getDefaultModel(loadedModels)
        setCurrentModel(defaultModel)

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
  }, [currentConversation?.id])

  const selectConversation = useCallback((conversation: Conversation) =>
  {
    setCurrentConversation(conversation)
    setView('chat')
  }, [])

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
  }, [])

  const addMessage = useCallback((message: Message) =>
  {
    setCurrentConversation(prev =>
    {
      if (!prev) return prev

      const updatedMessages = [...prev.messages, message]
      const updatedConversation: Conversation = {
        ...prev,
        messages: updatedMessages,
        updatedAt: Date.now(),
        title: prev.messages.length === 0 ? message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '') : prev.title
      }

      setConversations(convos => convos.map(c => c.id === prev.id ? updatedConversation : c))
      return updatedConversation
    })
  }, [])

  const updateMessage = useCallback((messageId: string, content: string) =>
  {
    setCurrentConversation(prev =>
    {
      if (!prev) return prev

      const updatedMessages = prev.messages.map(m =>
        m.id === messageId ? { ...m, content } : m
      )
      const updatedConversation: Conversation = {
        ...prev,
        messages: updatedMessages
      }

      setConversations(convos => convos.map(c => c.id === prev.id ? updatedConversation : c))
      return updatedConversation
    })
  }, [])

  const sendChatMessage = useCallback(async (content: string) =>
  {
    if (!currentModel || !content.trim()) return

    setIsLoading(true)
    setError('')

    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    }

    const assistantMessage: Message = {
      id: uuidv4(),
      role: 'assistant',
      content: '',
      timestamp: Date.now()
    }

    addMessage(userMessage)
    addMessage(assistantMessage)

    streamingContentRef.current = ''

    try
    {
      await sendMessage(
        currentModel,
        [...currentConversation?.messages || [], userMessage],
        (chunk) =>
        {
          streamingContentRef.current += chunk
          updateMessage(assistantMessage.id, streamingContentRef.current)
        },
        (apiError) =>
        {
          const errorMessage = `${apiError.code}: ${apiError.message}`
          setError(errorMessage)
          addLog({ level: 'error', message: errorMessage, context: 'API' })
        }
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
      setIsLoading(false)
    }
  }, [currentModel, currentConversation?.messages, addMessage, updateMessage])

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
    setIsModelConfigOpen(false)
    addLog({ level: 'info', message: `已添加模型：${model.name}`, context: '模型管理' })
  }, [])

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
    addLog({ level: 'info', message: `已删除模型：${id}`, context: '模型管理' })
  }, [currentModel?.id])

  const setDefaultModel = useCallback((id: string) =>
  {
    setModels(prev => prev.map(m => ({
      ...m,
      isDefault: m.id === id,
      updatedAt: m.id === id ? Date.now() : m.updatedAt
    })))
    setCurrentModel(prev =>
    {
      if (prev?.id === id) return prev
      return prev
    })
    setModels(prev =>
    {
      const model = prev.find(m => m.id === id)
      if (model)
      {
        setCurrentModel(model)
      }
      return prev
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
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {view === 'chat' && (
          <ChatArea
            conversation={currentConversation}
            currentModel={currentModel}
            onSendMessage={sendChatMessage}
            isLoading={isLoading}
            error={error}
            onClearError={() => setError('')}
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

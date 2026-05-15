import { useState, useEffect, useRef } from 'react'
import { AppSettings, ModelConfig } from '../types'
import { loadLogs, addLog, clearAllLogs } from '../utils/storage'
import { LogEntry } from '../types'
import { Sun, Moon, Monitor, FileText, Trash2, Download, Info, AlertTriangle, XCircle, RotateCcw, Trash2 as Trash2Icon, Globe, Cpu, ChevronDown, ChevronUp, Check, Zap, Minimize2 } from 'lucide-react'

interface SettingsPanelProps
{
  settings: AppSettings
  onUpdateSettings: (settings: Partial<AppSettings>) => void
  models: ModelConfig[]
}

type ThemeOption = 'light' | 'dark' | 'system'
type PromptTab = 'global' | 'model'
type SaveStatus = 'saving' | 'saved' | 'idle'

interface ThemeOptionInfo
{
  value: ThemeOption
  label: string
  icon: typeof Sun
}

const themeOptions: ThemeOptionInfo[] = [
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
  { value: 'system', label: '跟随系统', icon: Monitor }
]

const DEFAULT_SYSTEM_PROMPT = ``

const makeDebounce = <T extends (...args: any[]) => void>(fn: T, delay: number) =>
{
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const debounced = ((...args: Parameters<T>) =>
  {
    if (timeoutId) clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T & { cancel: () => void }
  debounced.cancel = () =>
  {
    if (timeoutId)
    {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }
  return debounced
}

function SettingsPanel({ settings, onUpdateSettings, models }: SettingsPanelProps)
{
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '')
  const [promptTab, setPromptTab] = useState<PromptTab>('global')
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null)
  const [modelPrompts, setModelPrompts] = useState<Record<string, string>>(settings.modelSystemPrompts || {})
  const [globalSaveStatus, setGlobalSaveStatus] = useState<SaveStatus>('idle')
  const [modelSaveStatusMap, setModelSaveStatusMap] = useState<Record<string, SaveStatus>>({})

  const skipGlobalSyncRef = useRef(false)
  const skipModelSyncRef = useRef(false)
  const settingsRef = useRef(settings)
  const globalSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const modelSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  useEffect(() =>
  {
    settingsRef.current = settings
  }, [settings])

  const debouncedSaveGlobal = useRef(makeDebounce((value: string) =>
  {
    onUpdateSettings({ systemPrompt: value.trim() || undefined })
    setGlobalSaveStatus('saved')
    addLog({ level: 'info', message: '全局规则和记忆已更新', context: '设置' })
    if (globalSaveTimerRef.current) clearTimeout(globalSaveTimerRef.current)
    globalSaveTimerRef.current = setTimeout(() => setGlobalSaveStatus('idle'), 2000)
  }, 800)).current

  const debouncedSaveModelMap = useRef<Map<string, ReturnType<typeof makeDebounce>>>(new Map())

  const getDebouncedSaveModel = (modelId: string) =>
  {
    if (!debouncedSaveModelMap.current.has(modelId))
    {
      debouncedSaveModelMap.current.set(modelId, makeDebounce((value: string) =>
      {
        const currentSettings = settingsRef.current
        const updated = { ...(currentSettings.modelSystemPrompts || {}) }
        if (value.trim())
        {
          updated[modelId] = value.trim()
        }
        else
        {
          delete updated[modelId]
        }
        onUpdateSettings({ modelSystemPrompts: updated })
        setModelSaveStatusMap(prev => ({ ...prev, [modelId]: 'saved' }))
        addLog({ level: 'info', message: '模型规则和记忆已更新', context: '设置' })
        const timer = modelSaveTimersRef.current.get(modelId)
        if (timer) clearTimeout(timer)
        modelSaveTimersRef.current.set(modelId, setTimeout(() =>
        {
          setModelSaveStatusMap(prev => ({ ...prev, [modelId]: 'idle' }))
        }, 2000))
      }, 800))
    }
    return debouncedSaveModelMap.current.get(modelId)!
  }

  useEffect(() =>
  {
    if (skipGlobalSyncRef.current)
    {
      skipGlobalSyncRef.current = false
      return
    }
    setSystemPrompt(settings.systemPrompt || '')
    setGlobalSaveStatus('idle')
  }, [settings.systemPrompt])

  useEffect(() =>
  {
    if (skipModelSyncRef.current)
    {
      skipModelSyncRef.current = false
      return
    }
    setModelPrompts(settings.modelSystemPrompts || {})
    setModelSaveStatusMap({})
  }, [settings.modelSystemPrompts])

  useEffect(() =>
  {
    return () =>
    {
      if (globalSaveTimerRef.current) clearTimeout(globalSaveTimerRef.current)
      modelSaveTimersRef.current.forEach(timer => clearTimeout(timer))
    }
  }, [])

  const enabledModels = models.filter(m => m.enabled)

  const loadLogsData = async () =>
  {
    setIsLoadingLogs(true)
    try
    {
      const loadedLogs = await loadLogs()
      setLogs(loadedLogs)
    }
    catch (error)
    {
      console.error('加载日志失败：', error)
    }
    finally
    {
      setIsLoadingLogs(false)
    }
  }

  const clearLogs = () =>
  {
    clearAllLogs()
    setLogs([])
  }

  const exportLogs = () =>
  {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-chat-logs-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    addLog({ level: 'info', message: '日志已导出', context: '设置' })
  }

  const formatTimestamp = (timestamp: number) =>
  {
    return new Date(timestamp).toLocaleString()
  }

  const getLogIcon = (level: LogEntry['level']) =>
  {
    switch (level)
    {
      case 'info': return Info
      case 'warning': return AlertTriangle
      case 'error': return XCircle
    }
  }

  const getLogColor = (level: LogEntry['level']) =>
  {
    switch (level)
    {
      case 'info': return 'text-blue-500 bg-blue-50 dark:bg-blue-900/30'
      case 'warning': return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30'
      case 'error': return 'text-red-500 bg-red-50 dark:bg-red-900/30'
    }
  }

  const getLevelLabel = (level: LogEntry['level']) =>
  {
    switch (level)
    {
      case 'info': return '信息'
      case 'warning': return '警告'
      case 'error': return '错误'
    }
  }

  const handleSystemPromptChange = (value: string) =>
  {
    setSystemPrompt(value)
    skipGlobalSyncRef.current = true
    setGlobalSaveStatus('saving')
    debouncedSaveGlobal(value)
  }

  const clearSystemPrompt = () =>
  {
    debouncedSaveGlobal.cancel()
    setSystemPrompt('')
    skipGlobalSyncRef.current = true
    onUpdateSettings({ systemPrompt: undefined })
    setGlobalSaveStatus('saved')
    addLog({ level: 'info', message: '全局规则和记忆已清空', context: '设置' })
    if (globalSaveTimerRef.current) clearTimeout(globalSaveTimerRef.current)
    globalSaveTimerRef.current = setTimeout(() => setGlobalSaveStatus('idle'), 2000)
  }

  const restoreDefaultSystemPrompt = () =>
  {
    debouncedSaveGlobal.cancel()
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    skipGlobalSyncRef.current = true
    onUpdateSettings({ systemPrompt: DEFAULT_SYSTEM_PROMPT || undefined })
    setGlobalSaveStatus('saved')
    addLog({ level: 'info', message: '全局规则和记忆已恢复默认', context: '设置' })
    if (globalSaveTimerRef.current) clearTimeout(globalSaveTimerRef.current)
    globalSaveTimerRef.current = setTimeout(() => setGlobalSaveStatus('idle'), 2000)
  }

  const handleModelPromptChange = (modelId: string, value: string) =>
  {
    setModelPrompts(prev => ({ ...prev, [modelId]: value }))
    skipModelSyncRef.current = true
    setModelSaveStatusMap(prev => ({ ...prev, [modelId]: 'saving' }))
    getDebouncedSaveModel(modelId)(value)
  }

  const clearModelPrompt = (modelId: string) =>
  {
    getDebouncedSaveModel(modelId).cancel()
    setModelPrompts(prev => ({ ...prev, [modelId]: '' }))
    skipModelSyncRef.current = true
    const updated = { ...(settingsRef.current.modelSystemPrompts || {}) }
    delete updated[modelId]
    onUpdateSettings({ modelSystemPrompts: updated })
    setModelSaveStatusMap(prev => ({ ...prev, [modelId]: 'saved' }))
    addLog({ level: 'info', message: '模型规则和记忆已清空', context: '设置' })
  }

  const deleteModelPrompt = (modelId: string) =>
  {
    getDebouncedSaveModel(modelId).cancel()
    const updated = { ...(settingsRef.current.modelSystemPrompts || {}) }
    delete updated[modelId]
    onUpdateSettings({ modelSystemPrompts: updated })
    setModelPrompts(prev =>
    {
      const next = { ...prev }
      delete next[modelId]
      return next
    })
    setModelSaveStatusMap(prev =>
    {
      const next = { ...prev }
      delete next[modelId]
      return next
    })
    if (expandedModelId === modelId)
    {
      setExpandedModelId(null)
    }
    addLog({ level: 'info', message: '已删除模型专属规则和记忆', context: '设置' })
  }

  const useGlobalPrompt = (modelId: string) =>
  {
    getDebouncedSaveModel(modelId).cancel()
    const updated = { ...(settingsRef.current.modelSystemPrompts || {}) }
    delete updated[modelId]
    onUpdateSettings({ modelSystemPrompts: updated })
    setModelPrompts(prev =>
    {
      const next = { ...prev }
      delete next[modelId]
      return next
    })
    setModelSaveStatusMap(prev =>
    {
      const next = { ...prev }
      delete next[modelId]
      return next
    })
    addLog({ level: 'info', message: '已切换为使用全局设置', context: '设置' })
  }

  const toggleModelExpand = (modelId: string) =>
  {
    setExpandedModelId(prev => prev === modelId ? null : modelId)
  }

  const hasModelSpecificPrompt = (modelId: string) =>
  {
    return modelId in (settings.modelSystemPrompts || {})
  }

  const getEffectivePromptSource = (modelId: string): 'model' | 'global' | 'none' =>
  {
    if (hasModelSpecificPrompt(modelId)) return 'model'
    if (settings.systemPrompt) return 'global'
    return 'none'
  }

  const globalCharCount = systemPrompt.length

  const renderSaveStatus = (status: SaveStatus) =>
  {
    if (status === 'saving')
    {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-amber-500 dark:text-amber-400">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
          保存中...
        </span>
      )
    }
    if (status === 'saved')
    {
      return (
        <span className="inline-flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
          <Check size={12} />
          已自动保存
        </span>
      )
    }
    return null
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">设置</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            配置应用设置
          </p>
        </div>
      </div>

      <div className="flex-1 scrollbar-visible p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">主题</h2>
            <div className="grid grid-cols-3 gap-3">
              {themeOptions.map((option) =>
              {
                const Icon = option.icon
                const isSelected = settings.theme === option.value
                return (
                  <button
                    key={option.value}
                    onClick={() => onUpdateSettings({ theme: option.value })}
                    className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    }`}
                  >
                    <Icon size={24} className={`${isSelected ? 'text-primary-500' : 'text-gray-500'}`} />
                    <span className={`text-sm font-medium ${isSelected ? 'text-primary-700 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {option.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">规则和记忆</h2>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  请注意：您输入的这些内容将影响大模型的最终输出结果，并且会大量增加 Token 额度的消耗。模型单独设置优先于全局设置生效。设置变更将自动保存并立即生效。
                </p>
              </div>
            </div>

            <div className="flex border-b border-gray-200 dark:border-gray-600 mb-4">
              <button
                onClick={() => setPromptTab('global')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  promptTab === 'global'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Globe size={16} />
                <span>全局设置</span>
              </button>
              <button
                onClick={() => setPromptTab('model')}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  promptTab === 'model'
                    ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Cpu size={16} />
                <span>单模型设置</span>
                {enabledModels.length > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    promptTab === 'model'
                      ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400'
                      : 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400'
                  }`}>
                    {enabledModels.length}
                  </span>
                )}
              </button>
            </div>

            {promptTab === 'global' && (
              <div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-blue-500 dark:text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-300">全局规则和记忆</p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                        适用于所有未设置单独规则的模型 · {globalCharCount} 字
                      </p>
                    </div>
                  </div>
                </div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => handleSystemPromptChange(e.target.value)}
                  placeholder="输入自定义规则和记忆内容，这些内容将作为系统提示词传递给所有未单独设置的模型。"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                  rows={8}
                />
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearSystemPrompt}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Trash2Icon size={14} />
                      <span>清空</span>
                    </button>
                    <button
                      onClick={restoreDefaultSystemPrompt}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <RotateCcw size={14} />
                      <span>恢复默认</span>
                    </button>
                  </div>
                  {renderSaveStatus(globalSaveStatus)}
                </div>

                {enabledModels.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap size={14} className="text-gray-500 dark:text-gray-400" />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">模型设置状态概览</span>
                    </div>
                    <div className="space-y-1.5">
                      {enabledModels.map(model =>
                      {
                        const source = getEffectivePromptSource(model.id)
                        return (
                          <div
                            key={model.id}
                            className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Cpu size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{model.name}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{model.modelId}</span>
                            </div>
                            {source === 'model' && (
                              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium">
                                <Cpu size={10} />
                                单独设置
                              </span>
                            )}
                            {source === 'global' && (
                              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                <Globe size={10} />
                                使用全局
                              </span>
                            )}
                            {source === 'none' && (
                              <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500">
                                未设置
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {promptTab === 'model' && (
              <div>
                {enabledModels.length === 0 ? (
                  <div className="text-center py-8">
                    <Cpu size={32} className="mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      请先添加至少一个模型
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Cpu size={16} className="text-purple-500 dark:text-purple-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">模型级规则和记忆</p>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
                            为每个模型单独配置专属规则，模型单独设置优先于全局设置生效
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {enabledModels.map((model) =>
                      {
                        const isExpanded = expandedModelId === model.id
                        const hasSpecific = hasModelSpecificPrompt(model.id)
                        const source = getEffectivePromptSource(model.id)
                        const currentPrompt = modelPrompts[model.id] ?? ''
                        const saveStatus = modelSaveStatusMap[model.id] || 'idle'

                        return (
                          <div
                            key={model.id}
                            className={`rounded-lg border-2 transition-colors ${
                              hasSpecific
                                ? 'border-purple-300 dark:border-purple-700 bg-purple-50/30 dark:bg-purple-900/10'
                                : 'border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-800/50'
                            }`}
                          >
                            <button
                              onClick={() => toggleModelExpand(model.id)}
                              className="w-full flex items-center justify-between px-4 py-3 text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <Cpu size={16} className={`flex-shrink-0 ${hasSpecific ? 'text-purple-500' : 'text-gray-400 dark:text-gray-500'}`} />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                                      {model.name}
                                    </span>
                                    {source === 'model' && (
                                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium">
                                        <Cpu size={10} />
                                        单独设置
                                      </span>
                                    )}
                                    {source === 'global' && (
                                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                        <Globe size={10} />
                                        使用全局
                                      </span>
                                    )}
                                    {source === 'none' && (
                                      <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500">
                                        未设置
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                                    {model.modelId}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                {hasSpecific && currentPrompt && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {currentPrompt.length} 字
                                  </span>
                                )}
                                {isExpanded ? (
                                  <ChevronUp size={16} className="text-gray-400" />
                                ) : (
                                  <ChevronDown size={16} className="text-gray-400" />
                                )}
                              </div>
                            </button>

                            {isExpanded && (
                              <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-600 pt-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                    {hasSpecific ? '模型专属规则和记忆' : '为此模型设置专属规则和记忆'}
                                  </span>
                                  {hasSpecific && (
                                    <span className="inline-flex items-center gap-1 text-xs text-purple-500 dark:text-purple-400 font-medium">
                                      <Zap size={10} />
                                      优先于全局设置
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  value={currentPrompt}
                                  onChange={(e) => handleModelPromptChange(model.id, e.target.value)}
                                  placeholder={`输入 ${model.name} 的专属规则和记忆内容，留空则使用全局设置。`}
                                  className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                                  rows={6}
                                />
                                <div className="flex items-center justify-between mt-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => clearModelPrompt(model.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                    >
                                      <Trash2Icon size={14} />
                                      <span>清空</span>
                                    </button>
                                    {hasSpecific && (
                                      <button
                                        onClick={() => useGlobalPrompt(model.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                      >
                                        <Globe size={14} />
                                        <span>使用全局设置</span>
                                      </button>
                                    )}
                                    {hasSpecific && (
                                      <button
                                        onClick={() => deleteModelPrompt(model.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                      >
                                        <Trash2 size={14} />
                                        <span>删除单独设置</span>
                                      </button>
                                    )}
                                  </div>
                                  {renderSaveStatus(saveStatus)}
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Minimize2 size={20} className="text-gray-700 dark:text-gray-300" />
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">压缩上下文</h2>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 mb-4">
              <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                  settings.compressContext
                    ? 'bg-emerald-100 dark:bg-emerald-900/40'
                    : 'bg-gray-200 dark:bg-gray-600'
                }`}>
                  <Minimize2 size={20} className={`transition-colors ${
                    settings.compressContext
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100">全局压缩上下文</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    开启后将在对话过长时自动压缩历史上下文，减少 Token 消耗
                  </p>
                </div>
              </div>
              <button
                onClick={() => onUpdateSettings({ compressContext: !settings.compressContext })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-700 ${
                  settings.compressContext
                    ? 'bg-emerald-500'
                    : 'bg-gray-300 dark:bg-gray-500'
                }`}
                role="switch"
                aria-checked={settings.compressContext || false}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                    settings.compressContext ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Cpu size={14} className="text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">按模型单独设置</span>
              </div>

              {enabledModels.length === 0 ? (
                <div className="text-center py-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
                  <Cpu size={24} className="mx-auto text-gray-400 dark:text-gray-500 mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    请先添加模型以进行单独设置
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {enabledModels.map(model =>
                  {
                    const isOn = settings.modelCompressContext?.[model.id] ?? false
                    return (
                      <div
                        key={model.id}
                        className="flex items-center justify-between px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Cpu size={14} className={`flex-shrink-0 transition-colors ${
                            isOn ? 'text-emerald-500' : 'text-gray-400 dark:text-gray-500'
                          }`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                              {model.name}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                              {model.modelId}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                          {
                            const updated = { ...(settings.modelCompressContext || {}) }
                            updated[model.id] = !isOn
                            onUpdateSettings({ modelCompressContext: updated })
                          }}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-700 flex-shrink-0 ml-3 ${
                            isOn
                              ? 'bg-emerald-500'
                              : 'bg-gray-300 dark:bg-gray-500'
                          }`}
                          role="switch"
                          aria-checked={isOn}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                              isOn ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">日志</h2>
              <button
                onClick={() =>
                {
                  setShowLogs(!showLogs)
                  if (!showLogs)
                  {
                    loadLogsData()
                  }
                }}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                <FileText size={16} />
                <span>{showLogs ? '收起' : '查看'}</span>
              </button>
            </div>

            {showLogs && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    共 {logs.length} 条日志
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={exportLogs}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                    >
                      <Download size={14} />
                      <span>导出</span>
                    </button>
                    <button
                      onClick={clearLogs}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                      <span>清空</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
                  {isLoadingLogs ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                      加载中...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 py-4">
                      暂无日志
                    </div>
                  ) : (
                    logs.map((log) =>
                    {
                      const Icon = getLogIcon(log.level)
                      return (
                        <div
                          key={log.id}
                          className={`flex items-start gap-3 p-2 rounded-lg ${getLogColor(log.level)}`}
                        >
                          <Icon size={14} className="flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">{formatTimestamp(log.timestamp)}</span>
                              {log.context && (
                                <span className="text-xs bg-white/50 dark:bg-gray-700/50 px-1.5 py-0.5 rounded">
                                  {log.context}
                                </span>
                              )}
                            </div>
                            <p className="text-sm mt-0.5">{log.message}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 p-6">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">关于</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              轻言 AI 助手 v1.0.0
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              请自行准备对应模型的 API Key，我们不对模型输出的任何内容负责。
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              基于 GPL 3.0 协议开源，禁止用于商业用途。
              <br />
              https://github.com/xingsen2005/PopChat
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel

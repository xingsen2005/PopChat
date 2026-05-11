import { useState } from 'react'
import { AppSettings } from '../types'
import { loadLogs, addLog, clearAllLogs } from '../utils/storage'
import { LogEntry } from '../types'
import { Sun, Moon, Monitor, FileText, Trash2, Download, Info, AlertTriangle, XCircle, Save, RotateCcw, Trash2 as Trash2Icon } from 'lucide-react'

interface SettingsPanelProps
{
  settings: AppSettings
  onUpdateSettings: (settings: Partial<AppSettings>) => void
}

type ThemeOption = 'light' | 'dark' | 'system'

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

function SettingsPanel({ settings, onUpdateSettings }: SettingsPanelProps)
{
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(settings.systemPrompt || '')
  const [saved, setSaved] = useState(true)

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
    setSaved(false)
  }

  const saveSystemPrompt = () =>
  {
    onUpdateSettings({ systemPrompt: systemPrompt.trim() })
    setSaved(true)
    addLog({ level: 'info', message: '系统提示词已更新', context: '设置' })
  }

  const clearSystemPrompt = () =>
  {
    setSystemPrompt('')
    setSaved(false)
  }

  const restoreDefaultSystemPrompt = () =>
  {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT)
    setSaved(false)
  }

  const charCount = systemPrompt.length

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
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {charCount} 字
              </span>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  请注意：您输入的这些内容将影响大模型的最终输出结果，并且会大量增加 Token 额度的消耗。
                </p>
              </div>
            </div>

            <textarea
              value={systemPrompt}
              onChange={(e) => handleSystemPromptChange(e.target.value)}
              placeholder="输入自定义规则和记忆内容，这些内容将作为系统提示词传递给大模型。"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
              rows={8}
            />

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
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
              <button
                onClick={saveSystemPrompt}
                disabled={saved || !systemPrompt.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Save size={14} />
                <span>{saved ? '已保存' : '保存'}</span>
              </button>
            </div>

            {/* <p className="text-xs text-gray-400 mt-3">
              提示：这些内容会在每次调用大模型时作为系统提示词传递，但不会显示在聊天界面中。
            </p> */}
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

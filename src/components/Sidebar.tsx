import { useState, useRef, useEffect } from 'react'
import { Conversation, ModelConfig, AppSettings } from '../types'
import {
  MessageSquarePlus,
  Trash2,
  Settings,
  Brain,
  ChevronDown,
  MessageCircle,
  Check,
  X,
  Pencil,
  Search,
  Globe,
  Cpu
} from 'lucide-react'

interface SidebarProps
{
  conversations: Conversation[]
  currentConversation: Conversation | null
  onNewConversation: () => void
  onSelectConversation: (conversation: Conversation) => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  currentModel: ModelConfig | null
  models: ModelConfig[]
  onSelectModel: (model: ModelConfig) => void
  onViewChange: (view: 'chat' | 'models' | 'settings') => void
  currentView: 'chat' | 'models' | 'settings'
  settings: AppSettings
  getEffectivePromptSource: (modelId: string) => 'model' | 'global' | 'none'
}

function Sidebar({
  conversations,
  currentConversation,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  currentModel,
  models,
  onSelectModel,
  onViewChange,
  currentView,
  settings,
  getEffectivePromptSource
}: SidebarProps)
{
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showModelDropdown, setShowModelDropdown] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const filteredConversations = searchQuery.trim()
    ? conversations.filter(c =>
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : conversations

  useEffect(() =>
  {
    const handleClickOutside = (e: MouseEvent) =>
    {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
      {
        setShowModelDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() =>
  {
    if (editingId && editInputRef.current)
    {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const enabledModels = models.filter(m => m.enabled)

  const formatTime = (timestamp: number) =>
  {
    const now = Date.now()
    const diff = now - timestamp

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

    return new Date(timestamp).toLocaleDateString()
  }

  const getConversationGroup = (timestamp: number): string =>
  {
    const now = Date.now()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime()
    const yesterdayStart = todayStart - 86400000
    const weekStart = todayStart - 7 * 86400000

    if (timestamp >= todayStart) return '今天'
    if (timestamp >= yesterdayStart) return '昨天'
    if (timestamp >= weekStart) return '最近7天'
    return '更早'
  }

  const groupedConversations = filteredConversations.reduce((groups, conv) =>
  {
    const group = getConversationGroup(conv.updatedAt)
    if (!groups[group]) groups[group] = []
    groups[group].push(conv)
    return groups
  }, {} as Record<string, Conversation[]>)

  const groupOrder = ['今天', '昨天', '最近7天', '更早']

  const handleDelete = (id: string) =>
  {
    onDeleteConversation(id)
    setShowDeleteConfirm(null)
  }

  const handleSelectModel = (model: ModelConfig) =>
  {
    onSelectModel(model)
    setShowModelDropdown(false)
  }

  const startEditing = (e: React.MouseEvent, conversation: Conversation) =>
  {
    e.stopPropagation()
    setEditingId(conversation.id)
    setEditingTitle(conversation.title)
  }

  const confirmEdit = () =>
  {
    if (editingId && editingTitle.trim())
    {
      onRenameConversation(editingId, editingTitle.trim())
    }
    setEditingId(null)
    setEditingTitle('')
  }

  const cancelEdit = () =>
  {
    setEditingId(null)
    setEditingTitle('')
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Enter')
    {
      e.preventDefault()
      confirmEdit()
    }
    else if (e.key === 'Escape')
    {
      e.preventDefault()
      cancelEdit()
    }
  }

  return (
    <div className="w-72 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-4 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
        >
          <MessageSquarePlus size={20} />
          <span>新建对话</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto chat-scrollbar py-2">
        <div className="px-3 mb-2">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
            对话列表
          </h2>
        </div>

        {conversations.length > 0 && (
          <div className="px-3 mb-2">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索对话..."
                className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-500 text-gray-800 dark:text-gray-100 placeholder-gray-400"
              />
            </div>
          </div>
        )}

        {filteredConversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
            <MessageCircle className="mx-auto mb-2 opacity-50" size={32} />
            <p className="text-sm">{searchQuery ? '未找到匹配的对话' : '暂无对话'}</p>
            <p className="text-xs mt-1">{searchQuery ? '尝试其他关键词' : '点击上方按钮开始新对话'}</p>
          </div>
        ) : (
          groupOrder.map(group =>
            groupedConversations[group]?.length > 0 && (
              <div key={group}>
                <div className="px-3 py-1.5">
                  <h3 className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2">
                    {group}
                  </h3>
                </div>
                {groupedConversations[group].map(conversation => (
                  <div
                    key={conversation.id}
              className={`group relative px-3 py-2 cursor-pointer transition-colors ${
                currentConversation?.id === conversation.id
                  ? 'bg-primary-50 dark:bg-gray-700'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
              onClick={() =>
              {
                if (editingId !== conversation.id)
                {
                  onSelectConversation(conversation)
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {editingId === conversation.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onBlur={cancelEdit}
                        className="flex-1 min-w-0 px-2 py-0.5 text-sm border border-primary-400 dark:border-primary-500 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                      <button
                        onMouseDown={(e) =>
                        {
                          e.preventDefault()
                          cancelEdit()
                        }}
                        className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <X size={14} />
                      </button>
                      <button
                        onClick={(e) =>
                        {
                          e.stopPropagation()
                          confirmEdit()
                        }}
                        className="p-0.5 text-primary-500 hover:text-primary-600 transition-colors"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {conversation.title}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {conversation.messages.length > 0
                      ? conversation.messages[conversation.messages.length - 1].content
                          .replace(/\[附件：[^\]]+\]/g, '')
                          .replace(/\n/g, ' ')
                          .trim()
                          .substring(0, 30) +
                        (conversation.messages[conversation.messages.length - 1].content.length > 30 ? '...' : '')
                      : '暂无消息'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatTime(conversation.updatedAt)}
                  </p>
                </div>

                {editingId !== conversation.id && (
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => startEditing(e, conversation)}
                      className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="重命名"
                    >
                      <Pencil size={14} className="text-gray-400 hover:text-blue-500" />
                    </button>
                    <button
                      onClick={(e) =>
                      {
                        e.stopPropagation()
                        setShowDeleteConfirm(showDeleteConfirm === conversation.id ? null : conversation.id)
                      }}
                      className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 size={14} className="text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                )}
              </div>

              {showDeleteConfirm === conversation.id && (
                <div className="mt-2 px-2 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg flex gap-2">
                  <button
                    onClick={(e) =>
                    {
                      e.stopPropagation()
                      handleDelete(conversation.id)
                    }}
                    className="flex-1 px-2 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                  >
                    删除
                  </button>
                  <button
                    onClick={(e) =>
                    {
                      e.stopPropagation()
                      setShowDeleteConfirm(null)
                    }}
                    className="flex-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
                ))
              }
              </div>
            ))
          )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 p-3">
        <div className="mb-3" ref={dropdownRef}>
          <div className="flex items-center justify-between px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Brain size={16} className="text-primary-500" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">模型</span>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                {currentModel?.name || '未选择模型'}
              </span>
              <ChevronDown
                size={16}
                className={`text-gray-400 transition-transform ${showModelDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showModelDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                {enabledModels.length === 0 ? (
                  <div className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    暂无可用模型
                  </div>
                ) : (
                  enabledModels.map(model => (
                    <button
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                        currentModel?.id === model.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm truncate ${
                            currentModel?.id === model.id
                              ? 'text-primary-600 dark:text-primary-400 font-medium'
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            {model.name}
                          </p>
                          {(() => {
                            const source = getEffectivePromptSource(model.id)
                            if (source === 'model') return (
                              <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1 py-0 rounded bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 font-medium leading-tight">
                                <Cpu size={8} />
                                专属
                              </span>
                            )
                            if (source === 'global') return (
                              <span className="flex-shrink-0 inline-flex items-center gap-0.5 text-[10px] px-1 py-0 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 leading-tight">
                                <Globe size={8} />
                                全局
                              </span>
                            )
                            return null
                          })()}
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                          {model.modelId}
                        </p>
                      </div>
                      {currentModel?.id === model.id && (
                        <Check size={16} className="text-primary-500 flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          <button
            onClick={() => onViewChange('models')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              currentView === 'models'
                ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Brain size={16} />
            <span className="text-sm font-medium">模型管理</span>
          </button>
          <button
            onClick={() => onViewChange('settings')}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              currentView === 'settings'
                ? 'bg-gray-100 dark:bg-gray-700 text-primary-600 dark:text-primary-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Settings size={16} />
            <span className="text-sm font-medium">设置</span>
          </button>
        </nav>
      </div>
    </div>
  )
}

export default Sidebar

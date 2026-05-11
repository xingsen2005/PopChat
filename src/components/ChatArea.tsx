import { useState, useRef, useEffect } from 'react'
import { Conversation, ModelConfig, Message, PendingAttachment } from '../types'
import { Send, Paperclip, Copy, Download, User, Bot, AlertCircle, CheckCircle, XCircle, X, Square, Trash2, Pencil, Check, RefreshCw, FileText, X as XIcon } from 'lucide-react'

const electronAPI = window.electronAPI

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 5

const getBaseName = (filePath: string): string =>
{
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || ''
}

const getFileExtension = (fileName: string): string =>
{
  const parts = fileName.split('.')
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : ''
}

interface ChatAreaProps
{
  conversation: Conversation | null
  currentModel: ModelConfig | null
  onSendMessage: (content: string, attachments: PendingAttachment[]) => void
  isLoading: boolean
  error: string
  onClearError: () => void
  onStopGeneration: () => void
  onDeleteMessage: (messageId: string) => void
  onEditAndResend: (messageId: string, newContent: string) => void
  onRegenerate: (messageId: string) => void
}

function ChatArea({
  conversation,
  currentModel,
  onSendMessage,
  isLoading,
  error,
  onClearError,
  onStopGeneration,
  onDeleteMessage,
  onEditAndResend,
  onRegenerate
}: ChatAreaProps)
{
  const [inputValue, setInputValue] = useState('')
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  useEffect(() =>
  {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () =>
    {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 100
      shouldAutoScrollRef.current = isAtBottom
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() =>
  {
    if (shouldAutoScrollRef.current && messagesEndRef.current)
    {
      requestAnimationFrame(() =>
      {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    }
  }, [conversation?.messages])

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustTextareaHeight = () =>
  {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const maxHeight = 200
    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px'
  }

  useEffect(() =>
  {
    adjustTextareaHeight()
  }, [inputValue])

  const handleSend = () =>
  {
    const hasContent = inputValue.trim()
    const hasAttachments = pendingAttachments.some(a => a.status === 'ready')

    if (!hasContent && !hasAttachments) return

    onSendMessage(inputValue, pendingAttachments.filter(a => a.status === 'ready'))
    setInputValue('')
    setPendingAttachments([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Enter' && !e.shiftKey)
    {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async () =>
  {
    const result = await electronAPI.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0)
    {
      const currentCount = pendingAttachments.length
      const availableSlots = MAX_FILES - currentCount

      if (availableSlots <= 0)
      {
        alert(`最多同时上传 ${MAX_FILES} 个文件`)
        return
      }

      const filesToProcess = result.filePaths.slice(0, availableSlots)

      if (filesToProcess.length < result.filePaths.length)
      {
        alert(`最多同时上传 ${MAX_FILES} 个文件，已选择前 ${filesToProcess.length} 个`)
      }

      const newAttachments: PendingAttachment[] = filesToProcess.map((filePath: string) => ({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        name: getBaseName(filePath),
        path: filePath,
        size: 0,
        status: 'pending' as const
      }))

      setPendingAttachments(prev => [...prev, ...newAttachments])

      for (const attachment of newAttachments)
      {
        setPendingAttachments(prev => prev.map(a =>
          a.id === attachment.id ? { ...a, status: 'reading' as const } : a
        ))

        try
        {
          const readResult = await electronAPI.readFileContent(attachment.path)

          if (!readResult.success)
          {
            setPendingAttachments(prev => prev.map(a =>
              a.id === attachment.id ? { ...a, status: 'error' as const, error: readResult.error } : a
            ))
            continue
          }

          setPendingAttachments(prev => prev.map(a =>
            a.id === attachment.id
              ? { ...a, status: 'ready' as const, content: readResult.content || '', size: (readResult.content || '').length }
              : a
          ))
        }
        catch (error)
        {
          console.error('文件读取错误：', error)
          setPendingAttachments(prev => prev.map(a =>
            a.id === attachment.id ? { ...a, status: 'error' as const, error: '读取文件失败' } : a
          ))
        }
      }
    }
  }

  const removeAttachment = (attachmentId: string) =>
  {
    setPendingAttachments(prev => prev.filter(a => a.id !== attachmentId))
  }

  const copyMessage = async (content: string): Promise<boolean> =>
  {
    try
    {
      await navigator.clipboard.writeText(content)
      return true
    }
    catch
    {
      return false
    }
  }

  const exportConversation = () =>
  {
    if (!conversation) return

    const exportData = {
      title: conversation.title,
      model: currentModel?.name,
      createdAt: new Date(conversation.createdAt).toISOString(),
      messages: conversation.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
        filePaths: m.filePaths
      }))
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conversation.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const canSend = (inputValue.trim() || pendingAttachments.some(a => a.status === 'ready')) && !!currentModel

  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-b border-red-200 dark:border-red-800 p-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-400">{error}</span>
            <button
              onClick={onClearError}
              className="ml-auto text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      <div ref={containerRef} className="flex-1 min-h-0 scrollbar-visible">
        {conversation && conversation.messages.length > 0 ? (
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {conversation.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onCopy={copyMessage}
                onDelete={onDeleteMessage}
                onEditAndResend={onEditAndResend}
                onRegenerate={onRegenerate}
                isStreaming={isLoading && message.role === 'assistant' && message.content !== '' && conversation.messages.indexOf(message) === conversation.messages.length - 1}
              />
            ))}
            {isLoading && (!conversation.messages.length || conversation.messages[conversation.messages.length - 1]?.role !== 'assistant' || conversation.messages[conversation.messages.length - 1]?.content === '') && (
              <div className="flex justify-start">
                <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 max-w-md">
                  <div className="flex items-center gap-2">
                    <Bot size={20} className="text-gray-500 dark:text-gray-400" />
                    <div className="typing-dots">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center px-4">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bot size={40} className="text-primary-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                轻言 AI 助手
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                开始与 AI 助手对话。请先在设置中选择一个模型。
              </p>
              {!currentModel ? (
                <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400">
                    请先配置模型，前往模型管理添加您的 API 密钥。
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-2">
                  <CheckCircle size={16} className="text-green-500" />
                  <p className="text-sm text-green-700 dark:text-green-400">
                    已就绪，正在使用 {currentModel.name}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {pendingAttachments.length > 0 && (
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
            <div className="flex flex-wrap gap-2">
              {pendingAttachments.map(attachment => (
                <div
                  key={attachment.id}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${
                    attachment.status === 'error'
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
                      : attachment.status === 'reading'
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400'
                        : 'bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300'
                  }`}
                >
                  <FileText size={14} />
                  <span className="max-w-[120px] truncate">{attachment.name}</span>
                  {attachment.status === 'reading' && (
                    <span className="text-yellow-500">读取中...</span>
                  )}
                  {attachment.status === 'error' && (
                    <span className="text-red-400" title={attachment.error}>失败</span>
                  )}
                  <button
                    onClick={() => removeAttachment(attachment.id)}
                    className="ml-1 p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="max-w-4xl mx-auto flex items-end gap-3">
            <button
              onClick={handleFileUpload}
              disabled={isLoading || pendingAttachments.length >= MAX_FILES}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              title={`添加附件 (${pendingAttachments.length}/${MAX_FILES})`}
            >
              <Paperclip size={20} />
            </button>

            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!currentModel || isLoading}
                placeholder={currentModel
                  ? pendingAttachments.length > 0 ? '输入消息（附件将随消息一起发送）...' : '输入消息...'
                  : '请先配置模型'}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                rows={1}
              />
            </div>

            {isLoading ? (
              <button
                onClick={onStopGeneration}
                className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
                title="停止生成"
              >
                <Square size={20} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend || isLoading}
                className="p-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                <Send size={20} />
              </button>
            )}

            {conversation && conversation.messages.length > 0 && (
              <button
                onClick={exportConversation}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="导出对话"
              >
                <Download size={20} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({
  message,
  onCopy,
  onDelete,
  onEditAndResend,
  onRegenerate,
  isStreaming
}: {
  message: Message
  onCopy: (content: string) => Promise<boolean>
  onDelete: (messageId: string) => void
  onEditAndResend: (messageId: string, newContent: string) => void
  onRegenerate: (messageId: string) => void
  isStreaming: boolean
})
{
  const isUser = message.role === 'user'
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  useEffect(() =>
  {
    setEditContent(message.content)
  }, [message.content])

  const handleCopy = async () =>
  {
    const success = await onCopy(message.content)
    if (success)
    {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    else
    {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 3000)
    }
  }

  const handleEditSave = () =>
  {
    if (editContent.trim() && editContent.trim() !== message.content)
    {
      onEditAndResend(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleEditCancel = () =>
  {
    setEditContent(message.content)
    setIsEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) =>
  {
    if (e.key === 'Enter' && !e.shiftKey)
    {
      e.preventDefault()
      handleEditSave()
    }
    if (e.key === 'Escape')
    {
      handleEditCancel()
    }
  }

  const renderAttachments = () =>
  {
    if (!message.filePaths || message.filePaths.length === 0) return null

    return (
      <div className="flex flex-wrap gap-1.5 mt-2">
        {message.filePaths.map((filePath, idx) =>
        {
          const fileName = getBaseName(filePath)
          const ext = getFileExtension(fileName)
          return (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-white/20 dark:bg-black/20 backdrop-blur-sm"
            >
              <FileText size={12} />
              <span className="truncate max-w-[100px]">{fileName}</span>
              {ext && (
                <span className="opacity-60">.{ext}</span>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={`flex message-fade-in group ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-3 max-w-md ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-primary-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        <div className={`flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-primary-300 dark:border-primary-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-800 dark:text-gray-100 text-sm"
                rows={3}
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={handleEditCancel}
                  className="px-3 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleEditSave}
                  className="px-3 py-1 text-xs bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors flex items-center gap-1"
                >
                  <Check size={12} />
                  发送
                </button>
              </div>
            </div>
          ) : (
            <div className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-primary-500 text-white rounded-tr-sm'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{message.content || (isStreaming ? '' : '(空)')}</p>
              {renderAttachments()}
              {isStreaming && (
                <div className="typing-dots mt-1">
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </div>
              )}
            </div>
          )}

          {!isEditing && (
            <div className={`flex items-center gap-1 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
              <span className="text-xs text-gray-400 mr-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </span>
              <button
                onClick={handleCopy}
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title={copyFailed ? '复制失败' : '复制'}
              >
                {copyFailed ? <XCircle size={12} className="text-red-500" /> : copied ? <CheckCircle size={12} className="text-green-500" /> : <Copy size={12} />}
              </button>
              {isUser && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                  title="编辑并重新发送"
                >
                  <Pencil size={12} />
                </button>
              )}
              {!isUser && !isStreaming && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-green-500 dark:hover:text-green-400"
                  title="重新输出"
                >
                  <RefreshCw size={12} />
                </button>
              )}
              <button
                onClick={() => onDelete(message.id)}
                className="p-1 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                title="删除"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ChatArea

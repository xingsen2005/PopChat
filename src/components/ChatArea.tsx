import { useState, useRef, useEffect } from 'react'
import { Conversation, ModelConfig, Message } from '../types'
import { Send, Paperclip, Copy, Download, User, Bot, AlertCircle, CheckCircle, X } from 'lucide-react'

const electronAPI = window.electronAPI

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 5

const getBaseName = (filePath: string): string =>
{
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || ''
}

interface ChatAreaProps
{
  conversation: Conversation | null
  currentModel: ModelConfig | null
  onSendMessage: (content: string) => void
  isLoading: boolean
  error: string
  onClearError: () => void
}

function ChatArea({
  conversation,
  currentModel,
  onSendMessage,
  isLoading,
  error,
  onClearError
}: ChatAreaProps)
{
  const [inputValue, setInputValue] = useState('')
  const [uploadingFiles, setUploadingFiles] = useState<{ id: string; name: string; progress: number; status: string; error?: string }[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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

  const handleSend = () =>
  {
    if (inputValue.trim())
    {
      onSendMessage(inputValue)
      setInputValue('')
    }
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
        { name: '文本文件', extensions: ['txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })

    if (!result.canceled && result.filePaths.length > 0)
    {
      const filesToProcess = result.filePaths.slice(0, MAX_FILES)

      if (filesToProcess.length < result.filePaths.length)
      {
        alert(`最多同时上传 ${MAX_FILES} 个文件`)
      }

      const newFiles = filesToProcess.map((filePath: string) => ({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
        name: getBaseName(filePath),
        progress: 0,
        status: 'uploading' as const,
        error: ''
      }))

      setUploadingFiles(prev => [...prev, ...newFiles])

      for (let i = 0; i < filesToProcess.length; i++)
      {
        const file = newFiles[i]
        const filePath = filesToProcess[i]

        try
        {
          const readResult = await electronAPI.readFileContent(filePath)

          if (!readResult.success)
          {
            setUploadingFiles(prev => prev.map(f =>
              f.id === file.id ? { ...f, progress: 0, status: 'error', error: readResult.error } : f
            ))
            continue
          }

          const content = readResult.content || ''
          const contentPreview = content.substring(0, 500) + (content.length > 500 ? '...' : '')

          setUploadingFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, progress: 100, status: 'completed' } : f
          ))

          await new Promise(resolve => setTimeout(resolve, 300))

          setUploadingFiles(prev => prev.filter(f => f.id !== file.id))
          setInputValue(prev => prev + `\n\n文件：${file.name}\n\n${contentPreview}`)
        }
        catch (error)
        {
          console.error('文件上传错误：', error)
          setUploadingFiles(prev => prev.map(f =>
            f.id === file.id ? { ...f, progress: 0, status: 'error', error: '读取文件失败' } : f
          ))
        }
      }
    }
  }

  const removeUploadingFile = (fileId: string) =>
  {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
  }

  const copyMessage = async (content: string) =>
  {
    try
    {
      await navigator.clipboard.writeText(content)
    }
    catch
    {
      console.log('复制失败')
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
        timestamp: new Date(m.timestamp).toISOString()
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

      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {conversation && conversation.messages.length > 0 ? (
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {conversation.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onCopy={copyMessage}
              />
            ))}
            {isLoading && (
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
                AI 桌面助手
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
        {uploadingFiles.length > 0 && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700">
            {uploadingFiles.map(file => (
              <div key={file.id} className="flex items-center gap-3 mb-2 last:mb-0">
                <button
                  onClick={() => removeUploadingFile(file.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
                >
                  <X size={14} className="text-gray-400" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 dark:text-gray-300 truncate">
                      {file.name}
                    </span>
                    {file.status === 'error' ? (
                      <span className="text-xs text-red-500">错误</span>
                    ) : (
                      <span className="text-xs text-gray-500">{file.progress}%</span>
                    )}
                  </div>
                  {file.status === 'error' ? (
                    <p className="text-xs text-red-500">{file.error}</p>
                  ) : (
                    <div className="w-full h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="p-4">
          <div className="max-w-4xl mx-auto flex items-end gap-3">
            <button
              onClick={handleFileUpload}
              disabled={isLoading}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Paperclip size={20} />
            </button>

            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!currentModel || isLoading}
                placeholder={currentModel
                  ? '输入消息...'
                  : '请先配置模型'}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                rows={3}
              />
            </div>

            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || !currentModel || isLoading}
              className="p-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
            >
              <Send size={20} />
            </button>

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

function MessageBubble({ message, onCopy }: { message: Message; onCopy: (content: string) => void })
{
  const isUser = message.role === 'user'

  return (
    <div className={`flex message-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-3 max-w-md ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser
            ? 'bg-primary-500 text-white'
            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}>
          {isUser ? <User size={16} /> : <Bot size={16} />}
        </div>

        <div className={`flex-1 ${isUser ? 'items-end' : 'items-start'}`}>
          <div className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-primary-500 text-white rounded-tr-sm'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
          }`}>
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>

          <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className="text-xs text-gray-400">
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
            <button
              onClick={() => onCopy(message.content)}
              className="p-1 opacity-0 hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <Copy size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChatArea

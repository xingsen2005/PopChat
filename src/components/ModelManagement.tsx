import { useState, useRef } from 'react'
import { ModelConfig, PROVIDERS } from '../types'
import { Plus, Edit, Trash2, Check, X, Star, Eye, EyeOff, GripVertical } from 'lucide-react'

interface ModelManagementProps
{
  models: ModelConfig[]
  onAddModel: () => void
  onEditModel: (model: ModelConfig) => void
  onDeleteModel: (id: string) => void
  onSetDefault: (id: string) => void
  onToggleEnabled: (id: string) => void
  onReorderModels: (models: ModelConfig[]) => void
}

function ModelManagement({
  models,
  onAddModel,
  onEditModel,
  onDeleteModel,
  onSetDefault,
  onToggleEnabled,
  onReorderModels
}: ModelManagementProps)
{
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragNodeRef = useRef<HTMLElement | null>(null)

  const formatDate = (timestamp: number) =>
  {
    return new Date(timestamp).toLocaleDateString()
  }

  const handleDragStart = (e: React.DragEvent<HTMLElement>, index: number) =>
  {
    dragNodeRef.current = e.currentTarget
    setDragIndex(index)

    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())

    requestAnimationFrame(() =>
    {
      if (dragNodeRef.current)
      {
        dragNodeRef.current.style.opacity = '0.4'
      }
    })
  }

  const handleDragEnd = () =>
  {
    if (dragNodeRef.current)
    {
      dragNodeRef.current.style.opacity = '1'
    }
    dragNodeRef.current = null
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent<HTMLElement>, index: number) =>
  {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (dragIndex !== null && dragIndex !== index)
    {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () =>
  {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent<HTMLElement>, index: number) =>
  {
    e.preventDefault()

    if (dragIndex === null || dragIndex === index)
    {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const reordered = [...models]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(index, 0, moved)

    onReorderModels(reordered)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-100 dark:bg-gray-800">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">模型管理</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              管理 AI 模型和 API 配置，拖拽卡片可调整排序
            </p>
          </div>
          <button
            onClick={onAddModel}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
          >
            <Plus size={20} />
            <span>添加模型</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-scroll custom-scrollbar p-6">
        {models.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Plus size={32} className="text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              暂未配置模型
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              添加您的第一个模型以开始使用
            </p>
            <button
              onClick={onAddModel}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
            >
              添加模型
            </button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-3">
            {models.map((model, index) => (
              <div
                key={model.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                className={`bg-white dark:bg-gray-700 rounded-xl border transition-all select-none ${
                  dragIndex === index
                    ? 'border-primary-300 dark:border-primary-700 shadow-lg scale-[1.01]'
                    : dragOverIndex === index
                      ? 'border-primary-400 dark:border-primary-500 shadow-md'
                      : model.enabled
                        ? 'border-gray-200 dark:border-gray-600'
                        : 'border-gray-300 dark:border-gray-600 opacity-60'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="拖拽排序"
                      >
                        <GripVertical size={18} />
                      </div>

                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        model.enabled ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-gray-100 dark:bg-gray-600'
                      }`}>
                        {model.isDefault ? (
                          <Star size={20} className="text-yellow-500" />
                        ) : model.enabled ? (
                          <Check size={20} className="text-green-500" />
                        ) : (
                          <X size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                            {model.name}
                          </h3>
                          {model.isDefault && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full">
                              默认
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {PROVIDERS[model.provider].name} - {model.modelId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleEnabled(model.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          model.enabled
                            ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                            : 'bg-gray-100 dark:bg-gray-600 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-500'
                        }`}
                        title={model.enabled ? '禁用' : '启用'}
                      >
                        {model.enabled ? <Eye size={18} /> : <EyeOff size={18} />}
                      </button>
                      <button
                        onClick={() => onEditModel(model)}
                        className="p-2 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
                        title="编辑"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() =>
                        {
                          if (confirm(`确定要删除 ${model.name} 吗？`))
                          {
                            onDeleteModel(model.id)
                          }
                        }}
                        className="p-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                        title="删除"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {model.customEndpoint && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        自定义端点：<span className="font-mono">{model.customEndpoint}</span>
                      </p>
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
                    <span>创建时间：{formatDate(model.createdAt)}</span>
                    <span>更新时间：{formatDate(model.updatedAt)}</span>
                    {!model.isDefault && model.enabled && (
                      <button
                        onClick={() => onSetDefault(model.id)}
                        className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 font-medium"
                      >
                        设为默认
                      </button>
                    )}
                  </div>
                </div>

                {dragOverIndex === index && dragIndex !== null && dragIndex !== index && (
                  <div className="h-0.5 bg-primary-500 rounded-full mx-4" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ModelManagement

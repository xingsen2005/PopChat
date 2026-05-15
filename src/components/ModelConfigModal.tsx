import { useState, useEffect, useRef } from 'react'
import { ModelConfig, PROVIDERS, ProviderType, ProviderInfo } from '../types'
import { fetchModels } from '../utils/api'
import { X, RefreshCw, Check, AlertCircle, Eye, EyeOff } from 'lucide-react'

interface ModelConfigModalProps
{
  model: ModelConfig | null
  providers: Record<ProviderType, ProviderInfo>
  onSave: (model: Omit<ModelConfig, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}

function ModelConfigModal({ model, providers, onSave, onCancel }: ModelConfigModalProps)
{
  const [name, setName] = useState(model?.name || '')
  const [provider, setProvider] = useState<ProviderType>(model?.provider || 'openai')
  const [apiKey, setApiKey] = useState('')
  const [modelId, setModelId] = useState(model?.modelId || '')
  const [customEndpoint, setCustomEndpoint] = useState(model?.customEndpoint || '')
  const [enabled, setEnabled] = useState(model?.enabled ?? true)
  const [isDefault, setIsDefault] = useState(model?.isDefault ?? false)
  const [useManualModelId, setUseManualModelId] = useState(false)
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [hasFetched, setHasFetched] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const apiKeyRef = useRef<HTMLInputElement>(null)

  const isEditing = !!model
  const apiKeyPlaceholder = isEditing ? '已配置（留空保持不变）' : '输入您的 API 密钥'

  useEffect(() =>
  {
    setModelId('')
    setAvailableModels([])
    setFetchError('')
    setHasFetched(false)
    if (useManualModelId)
    {
      setUseManualModelId(false)
    }
  }, [provider])

  useEffect(() =>
  {
    if (!useManualModelId && availableModels.length > 0 && !modelId)
    {
      setModelId(availableModels[0])
    }
  }, [availableModels, useManualModelId, modelId])

  const fetchAvailableModels = async () =>
  {
    if (!apiKey.trim())
    {
      setFetchError('请先输入 API 密钥')
      return
    }

    setIsFetchingModels(true)
    setFetchError('')
    setHasFetched(true)

    try
    {
      const tempConfig: ModelConfig = {
        id: '',
        name: '',
        provider,
        apiKey: apiKey.trim(),
        modelId: '',
        enabled: true,
        isDefault: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }

      const result = await fetchModels(tempConfig)

      if (result.success && result.data.length > 0)
      {
        setAvailableModels(result.data)
        setUseManualModelId(false)
      }
      else
      {
        const errorMsg = result.error
          ? `${result.error.code}: ${result.error.message}`
          : '获取模型列表失败，请手动输入。'
        setFetchError(errorMsg)
        setUseManualModelId(true)
      }
    }
    catch (error)
    {
      setFetchError('获取模型列表失败，请手动输入。')
      setUseManualModelId(true)
    }
    finally
    {
      setIsFetchingModels(false)
    }
  }

  const handleApiKeyBlur = () =>
  {
    if (apiKey.trim() && !useManualModelId && !hasFetched)
    {
      fetchAvailableModels()
    }
  }

  const validate = () =>
  {
    const newErrors: Record<string, string> = {}

    if (!name.trim())
    {
      newErrors.name = '名称为必填项'
    }

    if (!apiKey.trim() && !isEditing)
    {
      newErrors.apiKey = 'API 密钥为必填项'
    }

    if (!modelId.trim())
    {
      newErrors.modelId = '模型 ID 为必填项'
    }

    if (customEndpoint.trim())
    {
      try
      {
        const url = new URL(customEndpoint.trim())
        if (url.protocol !== 'https:' && url.protocol !== 'http:')
        {
          newErrors.customEndpoint = '端点 URL 必须以 http:// 或 https:// 开头'
        }
      }
      catch
      {
        newErrors.customEndpoint = '请输入有效的 URL 格式'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () =>
  {
    if (!validate()) return

    onSave({
      name: name.trim(),
      provider,
      apiKey: apiKey.trim() || (isEditing ? model?.apiKey : ''),
      modelId: modelId.trim(),
      customEndpoint: customEndpoint.trim() || undefined,
      enabled,
      isDefault
    })
  }

  const handleProviderChange = (value: string) =>
  {
    setProvider(value as ProviderType)
    setModelId('')
    setCustomEndpoint('')
    setFetchError('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {model ? '编辑模型' : '添加模型'}
          </h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              名称 *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="模型显示名称"
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
              }`}
            />
            {errors.name && (
              <p className="text-xs text-red-500 mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              服务商 *
            </label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-800 dark:text-gray-100"
            >
              {Object.entries(providers).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              API 密钥 *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={apiKeyRef}
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setHasFetched(false) }}
                  onBlur={handleApiKeyBlur}
                  placeholder={apiKeyPlaceholder}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    errors.apiKey ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title={showApiKey ? '隐藏' : '显示'}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={fetchAvailableModels}
                disabled={isFetchingModels || (!apiKey.trim() && !isEditing)}
                className="px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap"
                title="获取模型列表"
              >
                <RefreshCw size={14} className={isFetchingModels ? 'animate-spin' : ''} />
                验证
              </button>
            </div>
            {errors.apiKey && (
              <p className="text-xs text-red-500 mt-1">{errors.apiKey}</p>
            )}
            {provider === 'zhipu' && (
              <p className="text-xs text-gray-400 mt-1">
                格式：APIKeyID.secret，如 abc123.def456
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                模型 ID *
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useManualModelId}
                  onChange={(e) => setUseManualModelId(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-primary-600"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">手动输入</span>
              </label>
            </div>

            {useManualModelId || availableModels.length === 0 ? (
              <input
                type="text"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                placeholder={hasFetched && availableModels.length === 0 ? '输入模型 ID（如 glm-4-flash）' : '输入模型 ID'}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  errors.modelId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                }`}
              />
            ) : (
              <div className="relative">
                <select
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 appearance-none pr-8 ${
                    errors.modelId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
                  }`}
                >
                  <option value="">选择模型</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={fetchAvailableModels}
                  disabled={isFetchingModels}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <RefreshCw size={16} className={`text-gray-500 ${isFetchingModels ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}

            {errors.modelId && (
              <p className="text-xs text-red-500 mt-1">{errors.modelId}</p>
            )}

            {fetchError && (
              <div className="mt-2 flex items-center gap-2 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 p-2 rounded-lg">
                <AlertCircle size={14} />
                <span>{fetchError}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              自定义端点（可选）
            </label>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder={providers[provider].defaultEndpoint}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                errors.customEndpoint ? 'border-red-500' : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'
              }`}
            />
            {errors.customEndpoint && (
              <p className="text-xs text-red-500 mt-1">{errors.customEndpoint}</p>
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-primary-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">启用</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-primary-600"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">设为默认</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex items-center gap-2"
          >
            <Check size={16} />
            {model ? '更新' : '验证'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ModelConfigModal

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Loader2,
  RefreshCw,
  Info,
  Key,
  Globe,
  Cpu,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';
import { useAdminApi, type AISettings as AISettingsType } from '../hooks/useAdmin';

export default function AISettings() {
  const { t } = useTranslation('admin');
  const [settings, setSettings] = useState<AISettingsType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // Form state
  const [provider, setProvider] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [rateLimitEnabled, setRateLimitEnabled] = useState(true);
  const [rateLimitRequestsPerMin, setRateLimitRequestsPerMin] = useState(60);
  const [rateLimitBurst, setRateLimitBurst] = useState(10);

  const api = useAdminApi();

  const loadSettings = async () => {
    setLoading(true);
    setSaveError(null);
    const data = await api.getAISettings();
    if (data) {
      setSettings(data);
      setProvider(data.provider);
      setBaseUrl(data.baseUrl || '');
      setModel(data.model || '');
      setIsActive(data.isActive);
      setRateLimitEnabled(data.rateLimitEnabled);
      setRateLimitRequestsPerMin(data.rateLimitRequestsPerMin || 60);
      setRateLimitBurst(data.rateLimitBurst || 10);
      setApiKey(''); // Don't populate - user must enter new key
    } else if (api.error) {
      setSaveError(api.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    const updateData: Record<string, any> = {
      provider,
      baseUrl: baseUrl.trim() || undefined,
      model: model.trim() || undefined,
      isActive,
      rateLimitEnabled,
      rateLimitRequestsPerMin,
      rateLimitBurst,
    };

    // Only send API key if user entered a new one
    if (apiKey.trim()) {
      updateData.apiKey = apiKey.trim();
    }

    const result = await api.updateAISettings(updateData);

    if (result) {
      setSettings(result);
      setApiKey(''); // Clear after save
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else if (api.error) {
      setSaveError(api.error);
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('aiSettings.title', 'AI Settings')}</h1>
          <p className="text-gray-500">{t('aiSettings.subtitle', 'Configure the AI provider for chat and insights')}</p>
        </div>
        <button
          onClick={loadSettings}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('aiSettings.infoTitle', 'Database-based AI Configuration')}</p>
          <p className="mt-1">{t('aiSettings.infoDesc', 'Settings saved here take priority over environment variables. Leave fields empty to use environment defaults.')}</p>
        </div>
      </div>

      {/* Settings Form */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
        {/* Provider */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            {t('aiSettings.provider', 'Provider')}
          </label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="openai">OpenAI / OpenAI Compatible</option>
            <option value="mock">Mock (for testing)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {t('aiSettings.providerHint', 'Select "OpenAI / OpenAI Compatible" for OpenAI, Azure, or any OpenAI-compatible API')}
          </p>
        </div>

        {/* Base URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t('aiSettings.baseUrl', 'API Base URL')}
          </label>
          <input
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.openai.com/v1"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('aiSettings.baseUrlHint', 'Leave empty for default OpenAI endpoint. For Azure or other providers, enter the full base URL.')}
          </p>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Cpu className="w-4 h-4" />
            {t('aiSettings.model', 'Model')}
          </label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t('aiSettings.modelHint', 'e.g., gpt-4o-mini, gpt-4o, gpt-4-turbo, etc.')}
          </p>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Key className="w-4 h-4" />
            {t('aiSettings.apiKey', 'API Key')}
          </label>
          <div className="relative">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.hasApiKey ? t('aiSettings.apiKeyPlaceholder', 'Enter new key to update...') : t('aiSettings.apiKeyEmpty', 'Enter API key...')}
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {settings?.hasApiKey && (
            <p className="mt-1 text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              {t('aiSettings.currentKey', 'Current key')}: {settings.apiKey}
            </p>
          )}
          {!settings?.hasApiKey && (
            <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {t('aiSettings.noKey', 'No API key configured. AI features will use environment variable or be disabled.')}
            </p>
          )}
        </div>

        {/* Active Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
          <div>
            <div className="font-medium text-gray-800 flex items-center gap-2">
              {isActive ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <XCircle className="w-5 h-5 text-gray-400" />
              )}
              {t('aiSettings.enableDb', 'Enable Database Configuration')}
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {t('aiSettings.enableDbHint', 'When enabled, these settings override environment variables')}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
          </label>
        </div>

        {/* Rate Limit */}
        <div className="p-4 bg-gray-50 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('aiSettings.rateLimitTitle', 'Anonymous rate limit')}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {t('aiSettings.rateLimitHint', 'Limits per-IP traffic for public chat/insight endpoints to prevent abuse.')}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={rateLimitEnabled}
                onChange={(e) => setRateLimitEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
            </label>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('aiSettings.rateLimitPerMin', 'Requests per minute (per IP)')}
              </label>
              <input
                type="number"
                min={1}
                value={rateLimitRequestsPerMin}
                onChange={(e) => setRateLimitRequestsPerMin(Math.max(1, Number(e.target.value)))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('aiSettings.rateLimitBurst', 'Burst tokens')}
              </label>
              <input
                type="number"
                min={1}
                value={rateLimitBurst}
                onChange={(e) => setRateLimitBurst(Math.max(1, Number(e.target.value)))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                {t('aiSettings.rateLimitBurstHint', 'Allows short spikes while keeping overall flow limited.')}
              </p>
            </div>
          </div>
        </div>

        {/* Error/Success Messages */}
        {saveError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {t('common.error', 'Error')}: {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            {t('aiSettings.saveSuccess', 'Settings saved successfully!')}
          </div>
        )}

        {/* Save Button */}
        <div className="flex gap-3 pt-4 border-t border-gray-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('common.save', 'Save')}
          </button>
        </div>
      </div>

      {/* Updated timestamp */}
      {settings?.updatedAt && (
        <p className="text-xs text-gray-400 text-center">
          {t('aiSettings.lastUpdated', 'Last updated')}: {new Date(settings.updatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}

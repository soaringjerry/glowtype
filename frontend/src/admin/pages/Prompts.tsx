import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Save,
  Loader2,
  RefreshCw,
  Info,
  MessageSquare,
  Sparkles,
  Wand2,
  X,
  Edit2,
  Check
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface AIPrompt {
  id: number;
  key: string;
  name: string;
  content: string;
  isActive: boolean;
}

export default function Prompts() {
  const { t } = useTranslation('admin');
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<AIPrompt>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const api = useAdminApi();

  const loadPrompts = async () => {
    setLoading(true);
    const data = await api.listPrompts();
    if (data) setPrompts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPrompts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getIcon = (key: string) => {
    if (key.includes('insight')) return Sparkles;
    if (key.includes('chat')) return MessageSquare;
    return Wand2;
  };

  const handleEdit = (prompt: AIPrompt) => {
    setEditingId(prompt.id);
    setEditForm({ ...prompt });
    setIsCreating(false);
    setSaveError(null);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      key: '',
      name: '',
      content: '',
      isActive: true,
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    if (isCreating) {
      const result = await api.createPrompt(editForm);
      if (result) {
        await loadPrompts();
        setIsCreating(false);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    } else if (editingId) {
      const result = await api.updatePrompt(editingId, editForm);
      if (result) {
        await loadPrompts();
        setEditingId(null);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    }
    setSaving(false);
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditForm({});
    setSaveError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('prompts.title')}</h1>
          <p className="text-gray-500">{t('prompts.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadPrompts}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('prompts.refresh')}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
          >
            <Plus className="w-4 h-4" />
            {t('prompts.add')}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('prompts.infoTitle')}</p>
          <p className="mt-1">
            {t('prompts.placeholderHelp.prefix')}{' '}
            <code className="bg-blue-100 px-1 rounded">{'{glowtype}'}</code> {t('prompts.placeholderHelp.glowtype')}{' '}
            <code className="bg-blue-100 px-1 rounded">{'{language}'}</code> {t('prompts.placeholderHelp.language')}
          </p>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {isCreating ? t('prompts.createTitle') : t('prompts.editTitle')}
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('prompts.key')}</label>
                <input
                  type="text"
                  value={editForm.key || ''}
                  onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                  placeholder="cosmic_insight_system_en"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm"
                  disabled={!!editingId}
                />
                <p className="text-xs text-gray-500 mt-1">{t('prompts.keyHelp')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('prompts.name')}</label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Cosmic Insight - System (EN)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('prompts.content')}</label>
              <textarea
                value={editForm.content || ''}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm"
                rows={8}
                placeholder={t('prompts.editPlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={editForm.isActive !== false}
                onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                className="rounded text-purple-500 focus:ring-purple-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">{t('common.active')}</label>
            </div>
            {saveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {t('common.error')}: {saveError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('prompts.save')}
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
              >
                <X className="w-4 h-4" />
                {t('prompts.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompts List */}
      <div className="space-y-4">
        {prompts.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
            {t('prompts.empty')}
          </div>
        ) : (
          prompts.map((prompt) => {
            const Icon = getIcon(prompt.key);
            return (
              <div
                key={prompt.id}
                className={`bg-white rounded-2xl p-6 shadow-sm border transition ${
                  prompt.isActive ? 'border-gray-100 hover:border-purple-200' : 'border-gray-100 opacity-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-800">{prompt.name}</h3>
                          {prompt.isActive ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs font-medium rounded">
                              <Check className="w-3 h-3 inline mr-1" />
                              {t('common.active')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                              {t('prompts.inactive')}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 font-mono">{prompt.key}</p>
                      </div>
                      <button
                        onClick={() => handleEdit(prompt)}
                        className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 p-4 bg-gray-50 rounded-xl">
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono overflow-hidden">
                        {prompt.content.length > 300 ? `${prompt.content.slice(0, 300)}...` : prompt.content}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Success Note */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-700 flex items-start gap-3">
        <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('prompts.successNoteTitle')}</p>
          <p className="mt-1">{t('prompts.successNoteBody')}</p>
        </div>
      </div>
    </div>
  );
}

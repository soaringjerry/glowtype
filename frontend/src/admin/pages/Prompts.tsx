import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Loader2,
  RefreshCw,
  Info,
  MessageSquare,
  Sparkles,
  Wand2,
  X,
  Edit2,
  Check,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';
import type { PromptSlot } from '../hooks/useAdmin';

export default function Prompts() {
  const { t } = useTranslation('admin');
  const [slots, setSlots] = useState<PromptSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const api = useAdminApi();

  const loadPrompts = async () => {
    setLoading(true);
    const data = await api.listPrompts();
    if (data) setSlots(data);
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

  const getCategory = (key: string) => {
    if (key.includes('insight')) return t('prompts.category.cosmicInsight');
    if (key.includes('chat')) return t('prompts.category.chat');
    return t('prompts.category.other');
  };

  const getLanguage = (key: string) => {
    if (key.endsWith('_en')) return 'EN';
    if (key.endsWith('_zh')) return 'ZH';
    return '';
  };

  const handleEdit = (slot: PromptSlot) => {
    setEditingKey(slot.key);
    setEditContent(slot.currentContent);
    setEditActive(slot.isActive);
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editingKey) return;

    setSaving(true);
    setSaveError(null);

    const result = await api.updatePrompt(editingKey, {
      content: editContent,
      isActive: editActive,
    });

    if (result) {
      await loadPrompts();
      setEditingKey(null);
      setEditContent('');
    } else if (api.error) {
      setSaveError(api.error);
    }

    setSaving(false);
  };

  const handleReset = async (key: string) => {
    if (!confirm(t('prompts.confirmReset'))) return;

    setResetting(key);
    const result = await api.resetPrompt(key);

    if (result?.success) {
      await loadPrompts();
    }

    setResetting(null);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditContent('');
    setSaveError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  // Group slots by category
  const groupedSlots = slots.reduce((acc, slot) => {
    const category = getCategory(slot.key);
    if (!acc[category]) acc[category] = [];
    acc[category].push(slot);
    return acc;
  }, {} as Record<string, PromptSlot[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('prompts.title')}</h1>
          <p className="text-gray-500">{t('prompts.subtitle')}</p>
        </div>
        <button
          onClick={loadPrompts}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('prompts.refresh')}
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('prompts.infoTitle')}</p>
          <p className="mt-1">{t('prompts.infoDesc')}</p>
          <p className="mt-2 text-xs">
            {t('prompts.placeholderHelp.prefix')}{' '}
            <code className="bg-blue-100 px-1 rounded">{'{glowtype}'}</code> {t('prompts.placeholderHelp.glowtype')}{' '}
            <code className="bg-blue-100 px-1 rounded">{'{language}'}</code> {t('prompts.placeholderHelp.language')}
          </p>
        </div>
      </div>

      {/* Edit Modal */}
      {editingKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 text-lg">{t('prompts.editTitle')}</h3>
                <button
                  onClick={handleCancel}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Slot info */}
              {(() => {
                const slot = slots.find((s) => s.key === editingKey);
                if (!slot) return null;
                return (
                  <div className="bg-gray-50 rounded-xl p-4 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-700">{slot.name}</span>
                      <span className="text-xs text-gray-400 font-mono">{slot.key}</span>
                    </div>
                    <p className="text-sm text-gray-600">{slot.description}</p>
                  </div>
                );
              })()}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('prompts.content')}
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm"
                    rows={12}
                    placeholder={t('prompts.editPlaceholder')}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="rounded text-purple-500 focus:ring-purple-500"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                    {t('common.active')}
                  </label>
                </div>

                {saveError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {t('common.error')}: {saveError}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
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
          </div>
        </div>
      )}

      {/* Prompt Slots by Category */}
      {Object.entries(groupedSlots).map(([category, categorySlots]) => (
        <div key={category} className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-800">{category}</h2>

          {categorySlots.map((slot) => {
            const Icon = getIcon(slot.key);
            const lang = getLanguage(slot.key);

            return (
              <div
                key={slot.key}
                className={`bg-white rounded-2xl p-6 shadow-sm border transition ${
                  slot.isActive ? 'border-gray-100 hover:border-purple-200' : 'border-gray-100 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      slot.isActive
                        ? 'bg-gradient-to-br from-purple-500 to-pink-500'
                        : 'bg-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800">{slot.name}</h3>
                        {lang && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                            {lang}
                          </span>
                        )}
                        {slot.isActive ? (
                          <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs font-medium rounded flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            {t('common.active')}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                            {t('prompts.inactive')}
                          </span>
                        )}
                        {slot.isCustomized && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                            {t('prompts.customized')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {slot.isCustomized && (
                          <button
                            onClick={() => handleReset(slot.key)}
                            disabled={resetting === slot.key}
                            className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition disabled:opacity-50"
                            title={t('prompts.resetToDefault')}
                          >
                            {resetting === slot.key ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(slot)}
                          className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition"
                          title={t('prompts.edit')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 mb-3">{slot.description}</p>

                    {/* Content preview */}
                    <div className="mt-3 p-4 bg-gray-50 rounded-xl">
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono overflow-hidden">
                        {slot.currentContent.length > 300
                          ? `${slot.currentContent.slice(0, 300)}...`
                          : slot.currentContent}
                      </pre>
                    </div>

                    {/* Show default if customized */}
                    {slot.isCustomized && (
                      <details className="mt-3">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          {t('prompts.showDefault')}
                        </summary>
                        <div className="mt-2 p-4 bg-amber-50 rounded-xl border border-amber-100">
                          <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono overflow-hidden">
                            {slot.defaultContent.length > 300
                              ? `${slot.defaultContent.slice(0, 300)}...`
                              : slot.defaultContent}
                          </pre>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* No slots fallback */}
      {slots.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          {t('prompts.empty')}
        </div>
      )}

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

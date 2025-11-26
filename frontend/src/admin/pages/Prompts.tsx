import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Save,
  Loader2,
  RefreshCw,
  Info,
  MessageSquare,
  Sparkles,
  Wand2
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface AIPrompt {
  id: number;
  key: string;
  name: string;
  content: string;
}

const defaultPrompts = [
  {
    key: 'cosmic_insight_system',
    nameKey: 'prompts.defaults.cosmicInsightSystem.name',
    descriptionKey: 'prompts.defaults.cosmicInsightSystem.description',
  },
  {
    key: 'cosmic_insight_user',
    nameKey: 'prompts.defaults.cosmicInsightUser.name',
    descriptionKey: 'prompts.defaults.cosmicInsightUser.description',
  },
  {
    key: 'chat_system',
    nameKey: 'prompts.defaults.chatSystem.name',
    descriptionKey: 'prompts.defaults.chatSystem.description',
  },
  {
    key: 'chat_greeting',
    nameKey: 'prompts.defaults.chatGreeting.name',
    descriptionKey: 'prompts.defaults.chatGreeting.description',
  },
];

export default function Prompts() {
  const { t } = useTranslation('admin');
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
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
  }, []);

  const getPromptContent = (key: string) => {
    const prompt = prompts.find((p) => p.key === key);
    return prompt?.content || '';
  };

  const getPromptId = (key: string) => {
    const prompt = prompts.find((p) => p.key === key);
    return prompt?.id;
  };

  const handleEdit = (key: string) => {
    setEditingKey(key);
    setEditContent(getPromptContent(key));
  };

  const handleSave = async () => {
    if (!editingKey) return;
    setSaving(true);
    setSaveError(null);

    const id = getPromptId(editingKey);
    if (id) {
      const result = await api.updatePrompt(id, { content: editContent });
      if (!result && api.error) {
        setSaveError(api.error);
        setSaving(false);
        return;
      }
    }
    // Note: Creating new prompts would require backend changes

    await loadPrompts();
    setEditingKey(null);
    setEditContent('');
    setSaving(false);
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditContent('');
  };

  const getIcon = (key: string) => {
    if (key.includes('insight')) return Sparkles;
    if (key.includes('chat')) return MessageSquare;
    return Wand2;
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
        <button
          onClick={loadPrompts}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('prompts.refresh')}
        </button>
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

      {/* Prompts List */}
      <div className="space-y-4">
        {defaultPrompts.map((promptDef) => {
          const Icon = getIcon(promptDef.key);
          const content = getPromptContent(promptDef.key);
          const isEditing = editingKey === promptDef.key;
          const promptName = t(promptDef.nameKey);
          const promptDescription = t(promptDef.descriptionKey);

          return (
            <div
              key={promptDef.key}
              className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-800">{promptName}</h3>
                      <p className="text-sm text-gray-500">{promptDescription}</p>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => handleEdit(promptDef.key)}
                        className="px-4 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                      >
                        {t('prompts.edit')}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-4">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm"
                        rows={8}
                        placeholder={t('prompts.editPlaceholder')}
                      />
                      {saveError && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                          {t('common.error')}: {saveError}
                        </div>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4" />
                          )}
                          {t('prompts.save')}
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                        >
                          {t('prompts.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-4 bg-gray-50 rounded-xl">
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
                        {content || t('prompts.notConfigured')}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note about current implementation */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
        <p className="font-medium">{t('prompts.noteTitle')}</p>
        <p className="mt-1">
          {t('prompts.noteBody')}
        </p>
      </div>
    </div>
  );
}

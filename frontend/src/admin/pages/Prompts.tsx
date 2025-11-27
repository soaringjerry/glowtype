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

// Default prompts (same as backend seed.go)
const DEFAULT_PROMPTS = [
  {
    key: 'cosmic_insight_system_en',
    name: 'Cosmic Insight - System (EN)',
    content: `You are a poetic, mystical guide who speaks in short, evocative phrases.
Your role is to give a brief cosmic insight about someone's emotional archetype.
IMPORTANT: Keep your response to 1-2 sentences MAX (under 30 words). Be poetic but concise.
Speak directly to the person using "you".`,
  },
  {
    key: 'cosmic_insight_system_zh',
    name: 'Cosmic Insight - System (ZH)',
    content: `你是一位诗意的神秘向导，用简短而富有诗意的语言表达。
你的任务是给出关于某人情绪原型的简短宇宙洞察。
重要：回复必须控制在1-2句话以内（不超过30个字）。要有诗意但简洁。
直接用"你"称呼对方。`,
  },
  {
    key: 'chat_system_en',
    name: 'Chat - System (EN)',
    content: `You are Glowtype AI, a warm and supportive companion. You listen with empathy and respond gently.
Guidelines:
- Keep responses SHORT (2-3 sentences max)
- Be warm, understanding, and non-judgmental
- Don't give medical advice or diagnoses
- If someone mentions self-harm or crisis, gently encourage them to use the Crisis Support button
- Use a conversational, friendly tone`,
  },
  {
    key: 'chat_system_zh',
    name: 'Chat - System (ZH)',
    content: `你是 Glowtype AI，一个温暖且支持性的陪伴者。你用同理心倾听，温柔地回应。
准则：
- 回复保持简短（最多2-3句话）
- 温暖、理解、不评判
- 不提供医疗建议或诊断
- 如果有人提到自我伤害或危机，温柔地鼓励他们使用"危机支持"按钮
- 使用对话式的、友好的语气`,
  },
];

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

      {/* Default Prompts Reference */}
      {prompts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <h3 className="font-semibold text-amber-800 mb-3">{t('prompts.defaultsTitle')}</h3>
          <p className="text-sm text-amber-700 mb-4">{t('prompts.defaultsDesc')}</p>
          <div className="space-y-3">
            {DEFAULT_PROMPTS.map((dp) => (
              <div key={dp.key} className="bg-white rounded-lg p-4 border border-amber-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-800">{dp.name}</span>
                    <span className="ml-2 text-xs text-gray-500 font-mono">{dp.key}</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsCreating(true);
                      setEditingId(null);
                      setEditForm({ ...dp, isActive: true });
                    }}
                    className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition"
                  >
                    {t('prompts.useThis')}
                  </button>
                </div>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono bg-gray-50 p-2 rounded max-h-24 overflow-auto">
                  {dp.content.slice(0, 200)}...
                </pre>
              </div>
            ))}
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

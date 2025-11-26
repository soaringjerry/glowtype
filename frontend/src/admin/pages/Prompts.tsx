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
    name: 'Cosmic Insight - System',
    description: 'System instruction for generating cosmic insights',
  },
  {
    key: 'cosmic_insight_user',
    name: 'Cosmic Insight - User Prompt',
    description: 'User prompt template for cosmic insights. Use {glowtype} and {language} placeholders.',
  },
  {
    key: 'chat_system',
    name: 'Chat - System',
    description: 'System instruction for the AI chat feature',
  },
  {
    key: 'chat_greeting',
    name: 'Chat - Greeting',
    description: 'Initial greeting message template. Use {glowtype} and {language} placeholders.',
  },
];

export default function Prompts() {
  const { t: _t } = useTranslation('admin'); // i18n ready, TODO: replace hardcoded strings
  const [prompts, setPrompts] = useState<AIPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
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

    const id = getPromptId(editingKey);
    if (id) {
      await api.updatePrompt(id, { content: editContent });
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
          <h1 className="text-2xl font-bold text-gray-900">AI Prompts</h1>
          <p className="text-gray-500">Configure AI behavior and responses</p>
        </div>
        <button
          onClick={loadPrompts}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Prompt Placeholders</p>
          <p className="mt-1">
            Use these placeholders in your prompts: <code className="bg-blue-100 px-1 rounded">{'{glowtype}'}</code> for the user's type,{' '}
            <code className="bg-blue-100 px-1 rounded">{'{language}'}</code> for the language (Chinese/English).
          </p>
        </div>
      </div>

      {/* Prompts List */}
      <div className="space-y-4">
        {defaultPrompts.map((promptDef) => {
          const Icon = getIcon(promptDef.key);
          const content = getPromptContent(promptDef.key);
          const isEditing = editingKey === promptDef.key;

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
                      <h3 className="font-semibold text-gray-800">{promptDef.name}</h3>
                      <p className="text-sm text-gray-500">{promptDef.description}</p>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => handleEdit(promptDef.key)}
                        className="px-4 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                      >
                        Edit
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
                        placeholder="Enter prompt content..."
                      />
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
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-4 bg-gray-50 rounded-xl">
                      <pre className="text-sm text-gray-600 whitespace-pre-wrap font-mono">
                        {content || '(Not configured)'}
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
        <p className="font-medium">Note</p>
        <p className="mt-1">
          AI prompts are currently configured in the frontend code. This admin panel will allow you to manage them dynamically
          once the data migration is complete. For now, prompts are read-only unless already stored in the database.
        </p>
      </div>
    </div>
  );
}

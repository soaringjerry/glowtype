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
  AlertTriangle,
  Eye,
  History,
  Code2,
  CheckCircle2
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';
import type { PromptSlot, PromptHistory, PromptTemplateInfo } from '../hooks/useAdmin';

export default function Prompts() {
  const { t } = useTranslation('admin');
  const [slots, setSlots] = useState<PromptSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [resettingAll, setResettingAll] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // New states for template features
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; error?: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [templateInfo, setTemplateInfo] = useState<PromptTemplateInfo | null>(null);
  const [showVariables, setShowVariables] = useState(false);

  // History states
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [history, setHistory] = useState<PromptHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);

  const api = useAdminApi();

  const handleResetAll = async () => {
    if (!confirm(t('common.confirmReset'))) return;
    setResettingAll(true);
    const result = await api.resetAllPrompts();
    if (result) {
      await loadPrompts();
      alert(t('common.resetSuccess'));
    } else if (api.error) {
      alert(t('common.resetFailed') + ': ' + api.error);
    }
    setResettingAll(false);
  };

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
    setValidationResult(null);
    setPreviewResult(null);
    setShowPreview(false);
    setShowVariables(false);
  };

  // Validate template syntax
  const handleValidate = async () => {
    setValidating(true);
    setValidationResult(null);
    const result = await api.validatePrompt(editContent);
    if (result) {
      setValidationResult(result);
    }
    setValidating(false);
  };

  // Preview rendered template
  const handlePreview = async () => {
    setPreviewing(true);
    setPreviewResult(null);
    const result = await api.previewPrompt(editContent);
    if (result) {
      setPreviewResult(result.rendered);
      setShowPreview(true);
    } else if (api.error) {
      setSaveError(api.error);
    }
    setPreviewing(false);
  };

  // Load template variables info
  const loadTemplateInfo = async () => {
    if (!templateInfo) {
      const info = await api.getPromptVariables();
      if (info) {
        setTemplateInfo(info);
      }
    }
    setShowVariables(!showVariables);
  };

  // Load history for a prompt
  const handleShowHistory = async (key: string) => {
    setHistoryKey(key);
    setLoadingHistory(true);
    const data = await api.getPromptHistory(key);
    if (data) {
      setHistory(data);
    }
    setLoadingHistory(false);
  };

  // Rollback to a specific version
  const handleRollback = async (historyId: number) => {
    if (!historyKey) return;
    if (!confirm(t('prompts.confirmRollback'))) return;

    setRollingBack(true);
    const result = await api.rollbackPrompt(historyKey, historyId);
    if (result?.success) {
      await loadPrompts();
      setHistoryKey(null);
      setHistory([]);
    } else if (api.error) {
      alert(api.error);
    }
    setRollingBack(false);
  };

  const closeHistory = () => {
    setHistoryKey(null);
    setHistory([]);
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAll}
            disabled={resettingAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition disabled:opacity-50"
            title={t('common.resetToDefaults')}
          >
            <RotateCcw className={`w-4 h-4 ${resettingAll ? 'animate-spin' : ''}`} />
            {t('common.reset')}
          </button>
          <button
            onClick={loadPrompts}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('prompts.refresh')}
          </button>
        </div>
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
          <div className="bg-white rounded-2xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
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
                {/* Template Variables Reference */}
                <div>
                  <button
                    onClick={loadTemplateInfo}
                    className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 transition"
                  >
                    <Code2 className="w-4 h-4" />
                    {showVariables ? t('prompts.hideVariables') : t('prompts.showVariables')}
                  </button>

                  {showVariables && templateInfo && (
                    <div className="mt-2 p-4 bg-purple-50 rounded-xl border border-purple-100 text-sm">
                      <h4 className="font-medium text-purple-800 mb-2">{t('prompts.availableVariables')}</h4>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {templateInfo.variables.map((v) => (
                          <div key={v.name} className="text-purple-700">
                            <code className="bg-purple-100 px-1 rounded">{`{{.${v.name}}}`}</code>
                            <span className="text-xs text-purple-500 ml-2">{v.type}</span>
                            <p className="text-xs text-gray-600 mt-0.5">{v.description}</p>
                          </div>
                        ))}
                      </div>
                      <h4 className="font-medium text-purple-800 mb-2">{t('prompts.syntaxExamples')}</h4>
                      <div className="space-y-1">
                        {Object.entries(templateInfo.syntax).map(([name, example]) => (
                          <div key={name} className="text-purple-700">
                            <span className="text-xs text-gray-600">{name}:</span>{' '}
                            <code className="bg-purple-100 px-1 rounded text-xs">{example}</code>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('prompts.content')}
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => {
                      setEditContent(e.target.value);
                      setValidationResult(null);
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none font-mono text-sm"
                    rows={12}
                    placeholder={t('prompts.editPlaceholder')}
                  />
                </div>

                {/* Validate & Preview buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition disabled:opacity-50"
                  >
                    {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {t('prompts.validate')}
                  </button>
                  <button
                    onClick={handlePreview}
                    disabled={previewing}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition disabled:opacity-50"
                  >
                    {previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    {t('prompts.preview')}
                  </button>

                  {validationResult && (
                    <span className={`text-sm flex items-center gap-1 ${validationResult.valid ? 'text-green-600' : 'text-red-600'}`}>
                      {validationResult.valid ? (
                        <>
                          <Check className="w-4 h-4" />
                          {t('prompts.validTemplate')}
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          {validationResult.error}
                        </>
                      )}
                    </span>
                  )}
                </div>

                {/* Preview Panel */}
                {showPreview && previewResult && (
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-green-800">{t('prompts.previewTitle')}</h4>
                      <button
                        onClick={() => setShowPreview(false)}
                        className="text-green-600 hover:text-green-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-white p-3 rounded-lg max-h-64 overflow-y-auto">
                      {previewResult}
                    </pre>
                  </div>
                )}

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
                        <button
                          onClick={() => handleShowHistory(slot.key)}
                          className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                          title={t('prompts.viewHistory')}
                        >
                          <History className="w-4 h-4" />
                        </button>
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

      {/* History Modal */}
      {historyKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 text-lg flex items-center gap-2">
                  <History className="w-5 h-5" />
                  {t('prompts.historyTitle')}
                </h3>
                <button
                  onClick={closeHistory}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-4">
                <code className="text-sm text-gray-600">{historyKey}</code>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {t('prompts.noHistory')}
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                            v{item.version}
                          </span>
                          {item.changedBy && (
                            <span className="text-xs text-gray-500">
                              by {item.changedBy}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {new Date(item.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRollback(item.id)}
                          disabled={rollingBack}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
                        >
                          {rollingBack ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          {t('prompts.rollback')}
                        </button>
                      </div>
                      {item.changeMsg && (
                        <p className="text-sm text-gray-600 mb-2">{item.changeMsg}</p>
                      )}
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          {t('prompts.showContent')}
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                          {item.content}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

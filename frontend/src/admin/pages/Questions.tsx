import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  Upload,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
  RotateCcw
} from 'lucide-react';
import { useAdminApi, type ImportMode, type ImportResult, type QuestionImportItem } from '../hooks/useAdmin';

interface OptionConfig {
  text: { en: string; zh: string };
  value: string;
  scores: Record<string, number>;
}

interface QuizQuestion {
  id: number;
  questionId: string;
  order: number;
  questionZh: string;
  questionEn: string;
  options: OptionConfig[];
  primaryDimensionId?: number;
  version: number;
  isActive: boolean;
}

interface TraitDimension {
  id: number;
  key: string;
  nameEn: string;
}

export default function Questions() {
  const { t } = useTranslation('admin');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [dimensions, setDimensions] = useState<TraitDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<QuizQuestion>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<QuestionImportItem[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const api = useAdminApi();

  const handleReset = async () => {
    if (!confirm(t('common.confirmReset'))) return;
    setResetting(true);
    const result = await api.resetQuestions();
    if (result) {
      await loadData();
      alert(t('common.resetSuccess'));
    } else if (api.error) {
      alert(t('common.resetFailed') + ': ' + api.error);
    }
    setResetting(false);
  };

  const loadData = async () => {
    setLoading(true);
    const [questionsData, dimsData] = await Promise.all([
      api.listQuestions(),
      api.listDimensions(),
    ]);
    if (questionsData) setQuestions(questionsData);
    if (dimsData) setDimensions(dimsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = (question: QuizQuestion) => {
    setEditingId(question.id);
    setEditForm({
      ...question,
      options: question.options || [],
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      questionId: `q${questions.length + 1}`,
      order: questions.length + 1,
      questionZh: '',
      questionEn: '',
      options: [
        { text: { en: '', zh: '' }, value: '', scores: {} },
        { text: { en: '', zh: '' }, value: '', scores: {} },
        { text: { en: '', zh: '' }, value: '', scores: {} },
        { text: { en: '', zh: '' }, value: '', scores: {} },
      ],
      isActive: true,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    if (isCreating) {
      const result = await api.createQuestion(editForm);
      if (result) {
        await loadData();
        setIsCreating(false);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    } else if (editingId) {
      const result = await api.updateQuestion(editingId, editForm);
      if (result) {
        await loadData();
        setEditingId(null);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('questions.confirmDelete'))) return;
    await api.deleteQuestion(id);
    await loadData();
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditForm({});
  };

  const updateOption = (index: number, field: string, value: any) => {
    const options = [...(editForm.options || [])];
    if (field === 'textEn') {
      options[index] = { ...options[index], text: { ...options[index].text, en: value } };
    } else if (field === 'textZh') {
      options[index] = { ...options[index], text: { ...options[index].text, zh: value } };
    } else if (field === 'value') {
      options[index] = { ...options[index], value };
    }
    setEditForm({ ...editForm, options });
  };

  const updateOptionScore = (optIndex: number, dimKey: string, score: string) => {
    const options = [...(editForm.options || [])];
    const scores = { ...options[optIndex].scores };
    if (score === '' || score === '0') {
      delete scores[dimKey];
    } else {
      scores[dimKey] = parseFloat(score);
    }
    options[optIndex] = { ...options[optIndex], scores };
    setEditForm({ ...editForm, options });
  };

  const addOption = () => {
    const options = [...(editForm.options || [])];
    options.push({ text: { en: '', zh: '' }, value: '', scores: {} });
    setEditForm({ ...editForm, options });
  };

  const removeOption = (index: number) => {
    const options = [...(editForm.options || [])];
    options.splice(index, 1);
    setEditForm({ ...editForm, options });
  };

  const handleExport = () => {
    // Export in import-compatible format (without id, version, isActive)
    const exportData = questions.map(q => ({
      questionId: q.questionId,
      order: q.order,
      questionZh: q.questionZh,
      questionEn: q.questionEn,
      options: q.options,
      primaryDimensionId: q.primaryDimensionId,
    }));
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'quiz-questions.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        // Support both array format and { items: [...] } format
        const items = Array.isArray(parsed) ? parsed : parsed.items;
        if (Array.isArray(items)) {
          setImportData(items as QuestionImportItem[]);
        } else {
          setImportData(null);
          setImportResult({
            success: false,
            mode: importMode,
            total: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [{ index: -1, message: t('questions.invalidJsonFormat') || 'Invalid JSON format. Expected an array of questions.' }]
          });
        }
      } catch {
        setImportData(null);
        setImportResult({
          success: false,
          mode: importMode,
          total: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          errors: [{ index: -1, message: t('questions.jsonParseError') || 'Failed to parse JSON file.' }]
        });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportSubmit = async () => {
    if (!importData || importData.length === 0) return;
    setImporting(true);
    setImportResult(null);

    const result = await api.importQuestions(importData, importMode);
    if (result) {
      setImportResult(result);
      if (result.success) {
        await loadData();
      }
    } else if (api.error) {
      // API returned error without result
      setImportResult({
        success: false,
        mode: importMode,
        total: importData.length,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ index: -1, message: api.error }]
      });
    }
    setImporting(false);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportData(null);
    setImportResult(null);
    setImportMode('merge');
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
          <h1 className="text-2xl font-bold text-gray-900">{t('questions.title')}</h1>
          <p className="text-gray-500">{t('questions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition disabled:opacity-50"
            title={t('common.resetToDefaults')}
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            {t('common.reset')}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition"
          >
            <Upload className="w-4 h-4" />
            {t('common.import') || 'Import'}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <Download className="w-4 h-4" />
            {t('common.export') || 'Export'}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
          >
            <Plus className="w-4 h-4" />
            {t('questions.add')}
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {isCreating ? t('questions.add') : t('questions.edit')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.questionId')}</label>
              <input
                type="text"
                value={editForm.questionId || ''}
                onChange={(e) => setEditForm({ ...editForm, questionId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.order')}</label>
              <input
                type="number"
                value={editForm.order || 1}
                onChange={(e) => setEditForm({ ...editForm, order: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.questionZh')}</label>
              <textarea
                value={editForm.questionZh || ''}
                onChange={(e) => setEditForm({ ...editForm, questionZh: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('questions.questionEn')}</label>
              <textarea
                value={editForm.questionEn || ''}
                onChange={(e) => setEditForm({ ...editForm, questionEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                rows={2}
              />
            </div>
          </div>

          {/* Options */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-800">{t('questions.options')}</h4>
              <button
                onClick={addOption}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                + {t('questions.addOption')}
              </button>
            </div>
            <div className="space-y-4">
              {(editForm.options || []).map((opt, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-gray-700">{t('common.option')} {idx + 1}</span>
                    {(editForm.options?.length || 0) > 2 && (
                      <button
                        onClick={() => removeOption(idx)}
                        className="text-red-500 hover:text-red-600 text-sm"
                      >
                        {t('questions.removeOption')}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('questions.optionTextZh')}</label>
                      <input
                        type="text"
                        value={opt.text?.zh || ''}
                        onChange={(e) => updateOption(idx, 'textZh', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('questions.optionTextEn')}</label>
                      <input
                        type="text"
                        value={opt.text?.en || ''}
                        onChange={(e) => updateOption(idx, 'textEn', e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{t('common.value')}</label>
                      <input
                        type="text"
                        value={opt.value || ''}
                        onChange={(e) => updateOption(idx, 'value', e.target.value)}
                        placeholder={t('questions.valuePlaceholder')}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  {/* Dimension Scores */}
                  <div className="mt-3">
                    <label className="block text-xs text-gray-500 mb-2">{t('questions.scores')}</label>
                    <div className="flex flex-wrap gap-3">
                      {dimensions.map((dim) => (
                        <div key={dim.id} className="flex items-center gap-1">
                          <span className="text-xs text-gray-600">{dim.key}:</span>
                          <input
                            type="number"
                            value={opt.scores?.[dim.key] || ''}
                            onChange={(e) => updateOptionScore(idx, dim.key, e.target.value)}
                            placeholder="0"
                            className="w-14 px-1.5 py-1 border border-gray-300 rounded text-xs text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                          />
                        </div>
                      ))}
                      {dimensions.length === 0 && (
                        <span className="text-xs text-gray-400">{t('common.noDimensions')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {saveError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Error: {saveError}
            </div>
          )}
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('questions.save')}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              {t('questions.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
            {t('common.noData')}
          </div>
        ) : (
          questions
            .sort((a, b) => a.order - b.order)
            .map((q) => (
              <div
                key={q.id}
                className={`bg-white rounded-xl shadow-sm border transition ${
                  q.isActive ? 'border-gray-100 hover:border-purple-200' : 'border-gray-100 opacity-50'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs font-medium rounded">
                          #{q.order} - {q.questionId}
                        </span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded">
                          {t('questions.optionCount', { count: q.options?.length || 0 })}
                        </span>
                        {!q.isActive && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                            {t('common.inactive')}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-800 font-medium">{q.questionZh || q.questionEn}</p>
                      <p className="text-gray-500 text-sm mt-1">{q.questionEn}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition"
                      >
                        {expandedId === q.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleEdit(q)}
                        className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(q.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Options */}
                {expandedId === q.id && q.options && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <div className="space-y-2">
                      {q.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-4 text-sm">
                          <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                            {idx + 1}
                          </span>
                          <span className="flex-1 text-gray-700">
                            {opt.text?.zh || opt.text?.en || '-'}
                          </span>
                          <span className="text-gray-400">{opt.value}</span>
                          <div className="flex gap-2">
                            {Object.entries(opt.scores || {}).map(([dim, score]) => (
                              <span
                                key={dim}
                                className={`text-xs px-1.5 py-0.5 rounded ${
                                  score > 0
                                    ? 'bg-green-100 text-green-700'
                                    : score < 0
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {dim}: {score > 0 ? '+' : ''}{score}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('questions.importTitle') || 'Import Questions'}</h3>
              <button onClick={closeImportModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('questions.importMode') || 'Import Mode'}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setImportMode('merge')}
                  className={`p-3 rounded-xl border-2 text-left transition ${
                    importMode === 'merge'
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{t('questions.modeMerge') || 'Merge'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('questions.modeMergeDesc') || 'Update existing by questionId, create new ones'}
                  </div>
                </button>
                <button
                  onClick={() => setImportMode('replace')}
                  className={`p-3 rounded-xl border-2 text-left transition ${
                    importMode === 'replace'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{t('questions.modeReplace') || 'Replace'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('questions.modeReplaceDesc') || 'Delete ALL existing and import fresh'}
                  </div>
                </button>
              </div>
              {importMode === 'replace' && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-700">
                    {t('questions.replaceWarning') || 'This will permanently delete all existing questions before importing!'}
                  </span>
                </div>
              )}
            </div>

            {/* File Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('questions.selectFile') || 'Select JSON File'}
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 cursor-pointer transition bg-gray-50">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">
                  {importFile ? importFile.name : (t('questions.clickToSelectFile') || 'Click to select file')}
                </span>
                <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
              </label>
              {importData && (
                <div className="mt-2 text-sm text-gray-600">
                  {t('questions.itemsFound', { count: importData.length }) || `Found ${importData.length} questions to import`}
                </div>
              )}
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={`mb-4 p-3 rounded-lg ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {importResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className={`font-medium ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {importResult.success
                      ? (t('questions.importSuccessTitle') || 'Import Successful')
                      : (t('questions.importFailedTitle') || 'Import Failed')}
                  </span>
                </div>
                {importResult.success && (
                  <div className="text-sm text-green-700">
                    {t('questions.importStats', {
                      created: importResult.created,
                      updated: importResult.updated
                    }) || `Created: ${importResult.created}, Updated: ${importResult.updated}`}
                  </div>
                )}
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="text-xs text-red-700 bg-red-100 px-2 py-1 rounded">
                        {err.index >= 0 && <span className="font-medium">[{err.index + 1}] </span>}
                        {err.id && <span className="font-medium">{err.id}: </span>}
                        {err.message}
                      </div>
                    ))}
                  </div>
                )}
                {importResult.warnings && importResult.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {importResult.warnings.map((warn, idx) => (
                      <div key={idx} className="text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                        {warn}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeImportModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
              >
                {importResult?.success ? (t('common.close') || 'Close') : (t('common.cancel') || 'Cancel')}
              </button>
              {!importResult?.success && (
                <button
                  onClick={handleImportSubmit}
                  disabled={importing || !importData || importData.length === 0}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t('common.import') || 'Import'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

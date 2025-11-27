import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  RotateCcw
} from 'lucide-react';
import { useAdminApi, type ImportMode, type ImportResult, type RuleImportItem } from '../hooks/useAdmin';

interface DimensionCondition {
  min?: number;
  max?: number;
}

interface RuleConditions {
  dimensions: Record<string, DimensionCondition>;
}

interface ScoringRule {
  id: number;
  name: string;
  description: string;
  conditions: RuleConditions;
  resultTypeCode: string;
  priority: number;
  isFallback: boolean;
  isActive: boolean;
  version: number;
}

interface TraitDimension {
  id: number;
  key: string;
  nameEn: string;
}

interface Glowtype {
  id: number;
  typeCode: string;
}

export default function Rules() {
  const { t } = useTranslation('admin');
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [dimensions, setDimensions] = useState<TraitDimension[]>([]);
  const [glowtypes, setGlowtypes] = useState<Glowtype[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScoringRule>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Import modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<RuleImportItem[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [resetting, setResetting] = useState(false);

  const api = useAdminApi();

  const handleReset = async () => {
    if (!confirm(t('common.confirmReset'))) return;
    setResetting(true);
    const result = await api.resetRules();
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
    const [rulesData, dimsData, typesData, validationData] = await Promise.all([
      api.listRules(),
      api.listDimensions(),
      api.listGlowtypes(),
      api.validateRules(),
    ]);
    if (rulesData) setRules(rulesData);
    if (dimsData) setDimensions(dimsData);
    if (typesData) setGlowtypes(typesData);
    if (validationData) setWarnings(validationData.warnings || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = (rule: ScoringRule) => {
    setEditingId(rule.id);
    setEditForm({
      ...rule,
      conditions: rule.conditions || { dimensions: {} },
    });
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      name: '',
      description: '',
      conditions: { dimensions: {} },
      resultTypeCode: glowtypes[0]?.typeCode || '',
      priority: 0,
      isFallback: false,
      isActive: true,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    if (isCreating) {
      const result = await api.createRule(editForm);
      if (result) {
        await loadData();
        setIsCreating(false);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    } else if (editingId) {
      const result = await api.updateRule(editingId, editForm);
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
    if (!confirm(t('rules.confirmDelete'))) return;
    await api.deleteRule(id);
    await loadData();
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditForm({});
  };

  const updateCondition = (dimKey: string, field: 'min' | 'max', value: string) => {
    const conditions = editForm.conditions || { dimensions: {} };
    const dimConditions = { ...conditions.dimensions };

    if (!dimConditions[dimKey]) {
      dimConditions[dimKey] = {};
    }

    if (value === '') {
      delete dimConditions[dimKey][field];
      if (Object.keys(dimConditions[dimKey]).length === 0) {
        delete dimConditions[dimKey];
      }
    } else {
      dimConditions[dimKey][field] = parseFloat(value);
    }

    setEditForm({
      ...editForm,
      conditions: { dimensions: dimConditions },
    });
  };

  const getConditionValue = (dimKey: string, field: 'min' | 'max'): string => {
    const conditions = editForm.conditions as RuleConditions | undefined;
    const val = conditions?.dimensions?.[dimKey]?.[field];
    return val !== undefined ? String(val) : '';
  };

  // Export rules in import-compatible format
  const handleExport = async () => {
    const result = await api.exportRules();
    if (result) {
      const dataStr = JSON.stringify(result.items, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scoring-rules.json';
      a.click();
      URL.revokeObjectURL(url);
    }
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
          setImportData(items as RuleImportItem[]);
        } else {
          setImportData(null);
          setImportResult({
            success: false,
            mode: importMode,
            total: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [{ index: -1, message: t('rules.invalidJsonFormat') || 'Invalid JSON format. Expected an array of rules.' }]
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
          errors: [{ index: -1, message: t('rules.jsonParseError') || 'Failed to parse JSON file.' }]
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

    const result = await api.importRules(importData, importMode);
    if (result) {
      setImportResult(result);
      if (result.success) {
        await loadData();
      }
    } else if (api.error) {
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
          <h1 className="text-2xl font-bold text-gray-900">{t('rules.title')}</h1>
          <p className="text-gray-500">
            {t('rules.count', { count: rules.length })}
          </p>
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
            {t('rules.add')}
          </button>
        </div>
      </div>

      {/* Validation Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-yellow-800 font-medium mb-2">
            <AlertTriangle className="w-5 h-5" />
            {t('rules.validationWarnings')}
          </div>
          <ul className="space-y-1 text-sm text-yellow-700">
            {warnings.map((w, i) => (
              <li key={i}>- {w}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length === 0 && rules.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-green-800">
          <CheckCircle2 className="w-5 h-5" />
          {t('rules.validationOk')}
        </div>
      )}

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {isCreating ? t('rules.createTitle') : t('rules.editTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rules.name')}</label>
              <input
                type="text"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder={t('rules.namePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rules.resultType')}</label>
              <select
                value={editForm.resultTypeCode || ''}
                onChange={(e) => setEditForm({ ...editForm, resultTypeCode: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                {glowtypes.map((gt) => (
                  <option key={gt.id} value={gt.typeCode}>{gt.typeCode}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rules.priorityHint')}</label>
              <input
                type="number"
                value={editForm.priority ?? 0}
                onChange={(e) => setEditForm({ ...editForm, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.isFallback || false}
                  onChange={(e) => setEditForm({ ...editForm, isFallback: e.target.checked })}
                  className="rounded text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700">{t('rules.isFallback')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.isActive !== false}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="rounded text-purple-500 focus:ring-purple-500"
                />
                <span className="text-sm font-medium text-gray-700">{t('common.active')}</span>
              </label>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rules.description')}</label>
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                rows={2}
              />
            </div>
          </div>

          {/* Dimension Conditions */}
          <div className="mt-6">
            <h4 className="font-medium text-gray-800 mb-3">{t('rules.dimensionConditions')}</h4>
            <p className="text-sm text-gray-500 mb-4">
              {t('rules.dimensionConditionsHint')}
            </p>
            <div className="space-y-3">
              {dimensions.map((dim) => (
                <div key={dim.id} className="flex items-center gap-4 bg-gray-50 p-3 rounded-lg">
                  <span className="w-32 font-medium text-gray-700">{dim.key}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{t('rules.min')}:</span>
                    <input
                      type="number"
                      value={getConditionValue(dim.key, 'min')}
                      onChange={(e) => updateCondition(dim.key, 'min', e.target.value)}
                      placeholder="-inf"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">{t('rules.max')}:</span>
                    <input
                      type="number"
                      value={getConditionValue(dim.key, 'max')}
                      onChange={(e) => updateCondition(dim.key, 'max', e.target.value)}
                      placeholder="+inf"
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    />
                  </div>
                </div>
              ))}
              {dimensions.length === 0 && (
                <p className="text-gray-400 text-sm">{t('rules.noDimensions')}</p>
              )}
            </div>
          </div>

          {saveError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {t('common.error')}: {saveError}
            </div>
          )}
          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('rules.save')}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              {t('rules.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {rules.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
            {t('rules.empty')}
          </div>
        ) : (
          rules
            .sort((a, b) => b.priority - a.priority)
            .map((rule) => (
              <div
                key={rule.id}
                className={`bg-white rounded-xl p-4 shadow-sm border transition ${
                  rule.isFallback
                    ? 'border-yellow-200 bg-yellow-50'
                    : rule.isActive
                    ? 'border-gray-100 hover:border-purple-200'
                    : 'border-gray-100 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs font-medium rounded">
                        {t('rules.priorityLabel', { priority: rule.priority })}
                      </span>
                      <span className="px-2 py-1 bg-blue-100 text-blue-600 text-xs font-medium rounded">
                        {rule.resultTypeCode}
                      </span>
                      {rule.isFallback && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-600 text-xs font-medium rounded">
                          {t('rules.fallbackBadge')}
                        </span>
                      )}
                      {!rule.isActive && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                          {t('rules.inactiveBadge')}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-800 font-medium">{rule.name}</p>
                    {rule.description && (
                      <p className="text-gray-500 text-sm mt-1">{rule.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(rule.conditions?.dimensions || {}).map(([dim, cond]) => (
                        <span key={dim} className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {dim}: {cond.min !== undefined ? `>=${cond.min}` : ''}{' '}
                          {cond.max !== undefined ? `<=${cond.max}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('rules.importTitle') || 'Import Rules'}</h3>
              <button onClick={closeImportModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('rules.importMode') || 'Import Mode'}
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
                  <div className="font-medium text-gray-900">{t('rules.modeMerge') || 'Merge'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('rules.modeMergeDesc') || 'Update existing by name, create new ones'}
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
                  <div className="font-medium text-gray-900">{t('rules.modeReplace') || 'Replace'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('rules.modeReplaceDesc') || 'Delete ALL existing and import fresh'}
                  </div>
                </button>
              </div>
              {importMode === 'replace' && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-700">
                    {t('rules.replaceWarning') || 'This will permanently delete all existing rules before importing!'}
                  </span>
                </div>
              )}
            </div>

            {/* File Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('rules.selectFile') || 'Select JSON File'}
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 cursor-pointer transition bg-gray-50">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">
                  {importFile ? importFile.name : (t('rules.clickToSelectFile') || 'Click to select file')}
                </span>
                <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
              </label>
              {importData && (
                <div className="mt-2 text-sm text-gray-600">
                  {t('rules.itemsFound', { count: importData.length }) || `Found ${importData.length} rules to import`}
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
                      ? (t('rules.importSuccessTitle') || 'Import Successful')
                      : (t('rules.importFailedTitle') || 'Import Failed')}
                  </span>
                </div>
                {importResult.success && (
                  <div className="text-sm text-green-700">
                    {t('rules.importStats', {
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

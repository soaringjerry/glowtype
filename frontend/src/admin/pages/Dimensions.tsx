import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  RotateCcw,
  Upload,
  Download,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';
import type { ImportMode, ImportResult, DimensionImportItem } from '../hooks/useAdmin';

interface TraitDimension {
  id: number;
  key: string;
  nameZh: string;
  nameEn: string;
  positivePole: string;
  negativePole: string;
  description: string;
  strongThreshold: number;
  mildThreshold: number;
  displayOrder: number;
}

export default function Dimensions() {
  const { t } = useTranslation('admin');
  const [dimensions, setDimensions] = useState<TraitDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<TraitDimension>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  // Import/Export state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<DimensionImportItem[] | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const api = useAdminApi();

  const handleReset = async () => {
    if (!confirm(t('common.confirmReset'))) return;
    setResetting(true);
    const result = await api.resetDimensions();
    if (result) {
      await loadDimensions();
      alert(t('common.resetSuccess'));
    } else if (api.error) {
      alert(t('common.resetFailed') + ': ' + api.error);
    }
    setResetting(false);
  };

  const loadDimensions = async () => {
    setLoading(true);
    const data = await api.listDimensions();
    if (data) setDimensions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDimensions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = (dim: TraitDimension) => {
    setEditingId(dim.id);
    setEditForm(dim);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      key: '',
      nameZh: '',
      nameEn: '',
      positivePole: '',
      negativePole: '',
      description: '',
      strongThreshold: 3,
      mildThreshold: 1,
      displayOrder: dimensions.length > 0 ? Math.max(...dimensions.map(d => d.displayOrder)) + 1 : 1,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    if (isCreating) {
      const result = await api.createDimension(editForm);
      if (result) {
        await loadDimensions();
        setIsCreating(false);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    } else if (editingId) {
      const result = await api.updateDimension(editingId, editForm);
      if (result) {
        await loadDimensions();
        setEditingId(null);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('dimensions.confirmDelete'))) return;
    await api.deleteDimension(id);
    await loadDimensions();
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditForm({});
  };

  // Export dimensions in import-compatible format
  const handleExport = async () => {
    const result = await api.exportDimensions();
    if (result) {
      const dataStr = JSON.stringify(result.items, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'trait-dimensions.json';
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
          setImportData(items as DimensionImportItem[]);
        } else {
          setImportData(null);
          setImportResult({
            success: false,
            mode: importMode,
            total: 0,
            created: 0,
            updated: 0,
            skipped: 0,
            errors: [{ index: -1, message: t('dimensions.invalidJsonFormat') || 'Invalid JSON format. Expected an array of dimensions.' }]
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
          errors: [{ index: -1, message: t('dimensions.jsonParseError') || 'Failed to parse JSON file.' }]
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

    const result = await api.importDimensions(importData, importMode);
    if (result) {
      setImportResult(result);
      if (result.success) {
        await loadDimensions();
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
          <h1 className="text-2xl font-bold text-gray-900">{t('dimensions.title')}</h1>
          <p className="text-gray-500">
            {t('dimensions.count', { count: dimensions.length })}
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
            {t('dimensions.add')}
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {isCreating ? t('dimensions.new') : t('dimensions.editTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.keyUnique')}</label>
              <input
                type="text"
                value={editForm.key || ''}
                onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                placeholder={t('dimensions.keyPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.displayOrder')}</label>
              <input
                type="number"
                value={editForm.displayOrder ?? 0}
                onChange={(e) => setEditForm({ ...editForm, displayOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.nameZh')}</label>
              <input
                type="text"
                value={editForm.nameZh || ''}
                onChange={(e) => setEditForm({ ...editForm, nameZh: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.nameEn')}</label>
              <input
                type="text"
                value={editForm.nameEn || ''}
                onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.positivePole')}</label>
              <input
                type="text"
                value={editForm.positivePole || ''}
                onChange={(e) => setEditForm({ ...editForm, positivePole: e.target.value })}
                placeholder={t('dimensions.positivePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.negativePole')}</label>
              <input
                type="text"
                value={editForm.negativePole || ''}
                onChange={(e) => setEditForm({ ...editForm, negativePole: e.target.value })}
                placeholder={t('dimensions.negativePlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.strongThreshold')}</label>
              <input
                type="number"
                value={editForm.strongThreshold ?? 3}
                onChange={(e) => setEditForm({ ...editForm, strongThreshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.mildThreshold')}</label>
              <input
                type="number"
                value={editForm.mildThreshold ?? 1}
                onChange={(e) => setEditForm({ ...editForm, mildThreshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('dimensions.description')}</label>
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                rows={2}
              />
            </div>
          </div>
          {saveError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Error: {saveError}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('dimensions.save')}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              {t('dimensions.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Dimensions List */}
      <div className="space-y-3">
        {dimensions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
            {t('dimensions.empty')}
          </div>
        ) : (
          dimensions.map((dim) => (
            <div
              key={dim.id}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:border-purple-200 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-purple-100 text-purple-600 text-xs font-medium rounded">
                      {dim.key}
                    </span>
                    <span className="text-gray-400 text-xs">{t('dimensions.displayOrderLabel', { order: dim.displayOrder })}</span>
                  </div>
                  <p className="text-gray-800 font-medium">{dim.nameZh || dim.nameEn || dim.key}</p>
                  <p className="text-gray-500 text-sm mt-1">{dim.nameEn}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-green-600">+ {dim.positivePole}</span>
                    <span className="text-red-600">- {dim.negativePole}</span>
                    <span className="text-gray-400">
                      {t('dimensions.thresholdLabel', { mild: dim.mildThreshold, strong: dim.strongThreshold })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(dim)}
                    className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dim.id)}
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
              <h3 className="text-lg font-semibold text-gray-900">{t('dimensions.importTitle') || 'Import Dimensions'}</h3>
              <button onClick={closeImportModal} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('dimensions.importMode') || 'Import Mode'}
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
                  <div className="font-medium text-gray-900">{t('dimensions.modeMerge') || 'Merge'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('dimensions.modeMergeDesc') || 'Update existing by key, create new ones'}
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
                  <div className="font-medium text-gray-900">{t('dimensions.modeReplace') || 'Replace'}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t('dimensions.modeReplaceDesc') || 'Delete ALL existing and import fresh'}
                  </div>
                </button>
              </div>
              {importMode === 'replace' && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-700">
                    {t('dimensions.replaceWarning') || 'This will permanently delete all existing dimensions before importing!'}
                  </span>
                </div>
              )}
            </div>

            {/* File Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('dimensions.selectFile') || 'Select JSON File'}
              </label>
              <label className="flex items-center justify-center gap-2 px-4 py-6 border-2 border-dashed border-gray-300 rounded-xl hover:border-purple-400 cursor-pointer transition bg-gray-50">
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-gray-600">
                  {importFile ? importFile.name : (t('dimensions.clickToSelectFile') || 'Click to select file')}
                </span>
                <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
              </label>
              {importData && (
                <div className="mt-2 text-sm text-gray-600">
                  {t('dimensions.itemsFound', { count: importData.length }) || `Found ${importData.length} dimensions to import`}
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
                      ? (t('dimensions.importSuccessTitle') || 'Import Successful')
                      : (t('dimensions.importFailedTitle') || 'Import Failed')}
                  </span>
                </div>
                {importResult.success && (
                  <div className="text-sm text-green-700">
                    {t('dimensions.importStats', {
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

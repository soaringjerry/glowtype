import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  RotateCcw
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

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
    </div>
  );
}

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
  Eye
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface Glowtype {
  id: number;
  typeCode: string;
  nameZh: string;
  nameEn: string;
  taglineZh: string;
  taglineEn: string;
  descriptionZh: string;
  descriptionEn: string;
  selfCareTipsZh: string;
  selfCareTipsEn: string;
  disclaimerZh: string;
  disclaimerEn: string;
  primaryColor: string;
  gradient: string;
}

export default function Glowtypes() {
  const { t } = useTranslation('admin');
  const [glowtypes, setGlowtypes] = useState<Glowtype[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Glowtype>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const api = useAdminApi();

  const loadGlowtypes = async () => {
    setLoading(true);
    const data = await api.listGlowtypes();
    if (data) setGlowtypes(data);
    setLoading(false);
  };

  useEffect(() => {
    loadGlowtypes();
  }, []);

  const handleEdit = (glowtype: Glowtype) => {
    setEditingId(glowtype.id);
    setEditForm(glowtype);
    setIsCreating(false);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setEditForm({
      typeCode: '',
      nameZh: '',
      nameEn: '',
      taglineZh: '',
      taglineEn: '',
      descriptionZh: '[]',
      descriptionEn: '[]',
      selfCareTipsZh: '[]',
      selfCareTipsEn: '[]',
      disclaimerZh: '',
      disclaimerEn: '',
      primaryColor: '#8B5CF6',
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    if (isCreating) {
      const result = await api.createGlowtype(editForm);
      if (result) {
        await loadGlowtypes();
        setIsCreating(false);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    } else if (editingId) {
      const result = await api.updateGlowtype(editingId, editForm);
      if (result) {
        await loadGlowtypes();
        setEditingId(null);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('glowtypes.confirmDelete'))) return;
    await api.deleteGlowtype(id);
    await loadGlowtypes();
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsCreating(false);
    setEditForm({});
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(glowtypes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'glowtypes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          for (const g of imported) {
            await api.createGlowtype(g);
          }
          await loadGlowtypes();
          alert(t('glowtypes.importSuccess'));
        }
      } catch (err) {
        alert(t('glowtypes.importFailed'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
          <h1 className="text-2xl font-bold text-gray-900">{t('glowtypes.title')}</h1>
          <p className="text-gray-500">
            {t('glowtypes.subtitle')}
            <span className="ml-2 text-gray-400">
              ({t('glowtypes.count', { count: glowtypes.length })})
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition">
            <Upload className="w-4 h-4" />
            {t('common.import')}
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <Download className="w-4 h-4" />
            {t('common.export')}
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
          >
            <Plus className="w-4 h-4" />
            {t('glowtypes.add')}
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              {isCreating ? t('glowtypes.createTitle') : t('glowtypes.editTitle')}
            </h3>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <Eye className="w-4 h-4" />
              {previewMode ? t('glowtypes.editMode') : t('glowtypes.preview')}
            </button>
          </div>

          {previewMode ? (
            <div
              className="p-6 rounded-xl text-white"
              style={{ background: editForm.gradient || '#8B5CF6' }}
            >
              <h2 className="text-2xl font-bold mb-2">{editForm.nameZh || editForm.nameEn || t('glowtypes.previewTitleFallback')}</h2>
              <p className="text-white/80 mb-4">{editForm.taglineZh || editForm.taglineEn || t('glowtypes.previewTaglineFallback')}</p>
              <p className="text-white/90">{editForm.descriptionZh || editForm.descriptionEn || t('glowtypes.previewDescriptionFallback')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.typeCode')}</label>
                <input
                  type="text"
                  value={editForm.typeCode || ''}
                  onChange={(e) => setEditForm({ ...editForm, typeCode: e.target.value.toUpperCase() })}
                  placeholder={t('glowtypes.codePlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.primaryColor')}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={editForm.primaryColor || '#8B5CF6'}
                    onChange={(e) => setEditForm({ ...editForm, primaryColor: e.target.value })}
                    className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editForm.primaryColor || ''}
                    onChange={(e) => setEditForm({ ...editForm, primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.nameZh')}</label>
                <input
                  type="text"
                  value={editForm.nameZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, nameZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.nameEn')}</label>
                <input
                  type="text"
                  value={editForm.nameEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.taglineZh')}</label>
                <input
                  type="text"
                  value={editForm.taglineZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, taglineZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.taglineEn')}</label>
                <input
                  type="text"
                  value={editForm.taglineEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, taglineEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.gradientCss')}</label>
                <input
                  type="text"
                  value={editForm.gradient || ''}
                  onChange={(e) => setEditForm({ ...editForm, gradient: e.target.value })}
                  placeholder={t('glowtypes.gradientPlaceholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.descriptionZh')}</label>
                <textarea
                  value={editForm.descriptionZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, descriptionZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.descriptionEn')}</label>
                <textarea
                  value={editForm.descriptionEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, descriptionEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.tipsZh')}</label>
                <textarea
                  value={editForm.selfCareTipsZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, selfCareTipsZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.tipsEn')}</label>
                <textarea
                  value={editForm.selfCareTipsEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, selfCareTipsEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.disclaimerZh')}</label>
                <textarea
                  value={editForm.disclaimerZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, disclaimerZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.disclaimerEn')}</label>
                <textarea
                  value={editForm.disclaimerEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, disclaimerEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={2}
                />
              </div>
            </div>
          )}
          {saveError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {t('common.error')}: {saveError}
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('glowtypes.save')}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              {t('glowtypes.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Glowtypes Grid */}
      {glowtypes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          {t('glowtypes.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {glowtypes.map((g) => (
            <div
              key={g.id}
              className="rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition"
            >
              <div
                className="p-6 text-white"
                style={{ background: g.gradient || g.primaryColor || '#8B5CF6' }}
              >
                <h3 className="text-lg font-bold">{g.typeCode}</h3>
                <p className="text-white/80 text-sm mt-1">{g.nameZh || g.nameEn}</p>
              </div>
              <div className="p-4 bg-white">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {g.taglineZh || g.taglineEn || t('glowtypes.noTagline')}
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(g)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                  >
                    <Edit2 className="w-3 h-3" />
                    {t('glowtypes.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

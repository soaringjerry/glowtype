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
  const { t: _t } = useTranslation('admin'); // i18n ready, TODO: replace hardcoded strings
  const [glowtypes, setGlowtypes] = useState<Glowtype[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Glowtype>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
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
    if (isCreating) {
      const result = await api.createGlowtype(editForm);
      if (result) {
        await loadGlowtypes();
        setIsCreating(false);
        setEditForm({});
      }
    } else if (editingId) {
      const result = await api.updateGlowtype(editingId, editForm);
      if (result) {
        await loadGlowtypes();
        setEditingId(null);
        setEditForm({});
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this glowtype?')) return;
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
          alert('Import successful!');
        }
      } catch (err) {
        alert('Failed to parse JSON file');
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
          <h1 className="text-2xl font-bold text-gray-900">Glowtypes</h1>
          <p className="text-gray-500">{glowtypes.length} types defined</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 cursor-pointer transition">
            <Upload className="w-4 h-4" />
            Import
            <input type="file" accept=".json" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
          >
            <Plus className="w-4 h-4" />
            Add Type
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">
              {isCreating ? 'New Glowtype' : 'Edit Glowtype'}
            </h3>
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              <Eye className="w-4 h-4" />
              {previewMode ? 'Edit' : 'Preview'}
            </button>
          </div>

          {previewMode ? (
            <div
              className="p-6 rounded-xl text-white"
              style={{ background: editForm.gradient || '#8B5CF6' }}
            >
              <h2 className="text-2xl font-bold mb-2">{editForm.nameZh || editForm.nameEn || 'Type Name'}</h2>
              <p className="text-white/80 mb-4">{editForm.taglineZh || editForm.taglineEn || 'Tagline'}</p>
              <p className="text-white/90">{editForm.descriptionZh || editForm.descriptionEn || 'Description'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type Code</label>
                <input
                  type="text"
                  value={editForm.typeCode || ''}
                  onChange={(e) => setEditForm({ ...editForm, typeCode: e.target.value.toUpperCase() })}
                  placeholder="e.g., ENFJ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Chinese)</label>
                <input
                  type="text"
                  value={editForm.nameZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, nameZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English)</label>
                <input
                  type="text"
                  value={editForm.nameEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline (Chinese)</label>
                <input
                  type="text"
                  value={editForm.taglineZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, taglineZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tagline (English)</label>
                <input
                  type="text"
                  value={editForm.taglineEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, taglineEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Gradient CSS</label>
                <input
                  type="text"
                  value={editForm.gradient || ''}
                  onChange={(e) => setEditForm({ ...editForm, gradient: e.target.value })}
                  placeholder="linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Chinese) - JSON array</label>
                <textarea
                  value={editForm.descriptionZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, descriptionZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (English) - JSON array</label>
                <textarea
                  value={editForm.descriptionEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, descriptionEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={4}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Self-Care Tips (Chinese) - JSON array</label>
                <textarea
                  value={editForm.selfCareTipsZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, selfCareTipsZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Self-Care Tips (English) - JSON array</label>
                <textarea
                  value={editForm.selfCareTipsEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, selfCareTipsEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disclaimer (Chinese)</label>
                <textarea
                  value={editForm.disclaimerZh || ''}
                  onChange={(e) => setEditForm({ ...editForm, disclaimerZh: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disclaimer (English)</label>
                <textarea
                  value={editForm.disclaimerEn || ''}
                  onChange={(e) => setEditForm({ ...editForm, disclaimerEn: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  rows={2}
                />
              </div>
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Glowtypes Grid */}
      {glowtypes.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
          No glowtypes yet. Click "Add Type" to create one.
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
                  {g.taglineZh || g.taglineEn || 'No tagline'}
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(g)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
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

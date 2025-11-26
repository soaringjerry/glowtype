import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2
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
  const { t: _t } = useTranslation('admin'); // i18n ready, TODO: replace hardcoded strings
  const [dimensions, setDimensions] = useState<TraitDimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<TraitDimension>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const api = useAdminApi();

  const loadDimensions = async () => {
    setLoading(true);
    const data = await api.listDimensions();
    if (data) setDimensions(data);
    setLoading(false);
  };

  useEffect(() => {
    loadDimensions();
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
      displayOrder: dimensions.length,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    if (isCreating) {
      const result = await api.createDimension(editForm);
      if (result) {
        await loadDimensions();
        setIsCreating(false);
        setEditForm({});
      }
    } else if (editingId) {
      const result = await api.updateDimension(editingId, editForm);
      if (result) {
        await loadDimensions();
        setEditingId(null);
        setEditForm({});
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this dimension? This may affect existing rules.')) return;
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
          <h1 className="text-2xl font-bold text-gray-900">Trait Dimensions</h1>
          <p className="text-gray-500">
            {dimensions.length} dimension{dimensions.length !== 1 ? 's' : ''} - Define bipolar scoring axes
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          Add Dimension
        </button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {isCreating ? 'New Dimension' : 'Edit Dimension'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Key (unique)</label>
              <input
                type="text"
                value={editForm.key || ''}
                onChange={(e) => setEditForm({ ...editForm, key: e.target.value })}
                placeholder="e.g., energy, style"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <input
                type="number"
                value={editForm.displayOrder ?? 0}
                onChange={(e) => setEditForm({ ...editForm, displayOrder: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Positive Pole (+)</label>
              <input
                type="text"
                value={editForm.positivePole || ''}
                onChange={(e) => setEditForm({ ...editForm, positivePole: e.target.value })}
                placeholder="e.g., extrovert"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Negative Pole (-)</label>
              <input
                type="text"
                value={editForm.negativePole || ''}
                onChange={(e) => setEditForm({ ...editForm, negativePole: e.target.value })}
                placeholder="e.g., introvert"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Strong Threshold</label>
              <input
                type="number"
                value={editForm.strongThreshold ?? 3}
                onChange={(e) => setEditForm({ ...editForm, strongThreshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mild Threshold</label>
              <input
                type="number"
                value={editForm.mildThreshold ?? 1}
                onChange={(e) => setEditForm({ ...editForm, mildThreshold: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                rows={2}
              />
            </div>
          </div>
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

      {/* Dimensions List */}
      <div className="space-y-3">
        {dimensions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
            No dimensions yet. Click "Add Dimension" to create one.
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
                    <span className="text-gray-400 text-xs">Order: {dim.displayOrder}</span>
                  </div>
                  <p className="text-gray-800 font-medium">{dim.nameZh || dim.nameEn || dim.key}</p>
                  <p className="text-gray-500 text-sm mt-1">{dim.nameEn}</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="text-green-600">+ {dim.positivePole}</span>
                    <span className="text-red-600">- {dim.negativePole}</span>
                    <span className="text-gray-400">
                      Thresholds: {dim.mildThreshold} / {dim.strongThreshold}
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

import { useState, useEffect, useMemo } from 'react';
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
  Eye,
  RotateCcw,
  Palette,
  Info
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';
import { GlowtypeCard } from '../../components/GlowtypeCard';

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
  cardAccent: string;
  textColor: string;
}

// Color presets for easy selection
const COLOR_PRESETS = [
  { name: 'Indigo', cardAccent: 'from-indigo-50 to-blue-50', textColor: 'text-indigo-900', gradient: 'radial-gradient(circle at center, #a5b4fc, #818cf8, #4f46e5, transparent 70%)', primary: '#4f46e5' },
  { name: 'Rose', cardAccent: 'from-rose-50 to-orange-50', textColor: 'text-rose-900', gradient: 'radial-gradient(circle at center, #fbcfe8, #f472b6, #db2777, transparent 70%)', primary: '#db2777' },
  { name: 'Teal', cardAccent: 'from-teal-50 to-emerald-50', textColor: 'text-teal-900', gradient: 'radial-gradient(circle at center, #99f6e4, #5eead4, #14b8a6, transparent 70%)', primary: '#14b8a6' },
  { name: 'Amber', cardAccent: 'from-amber-50 to-orange-50', textColor: 'text-amber-900', gradient: 'radial-gradient(circle at center, #fde68a, #fbbf24, #d97706, transparent 70%)', primary: '#d97706' },
  { name: 'Purple', cardAccent: 'from-purple-50 to-violet-50', textColor: 'text-purple-900', gradient: 'radial-gradient(circle at center, #e9d5ff, #c084fc, #9333ea, transparent 70%)', primary: '#9333ea' },
  { name: 'Sky', cardAccent: 'from-sky-50 to-cyan-50', textColor: 'text-sky-900', gradient: 'radial-gradient(circle at center, #bae6fd, #38bdf8, #0284c7, transparent 70%)', primary: '#0284c7' },
  { name: 'Green', cardAccent: 'from-green-50 to-emerald-50', textColor: 'text-green-900', gradient: 'radial-gradient(circle at center, #bbf7d0, #4ade80, #16a34a, transparent 70%)', primary: '#16a34a' },
  { name: 'Pink', cardAccent: 'from-pink-50 to-fuchsia-50', textColor: 'text-pink-900', gradient: 'radial-gradient(circle at center, #fbcfe8, #f472b6, #db2777, transparent 70%)', primary: '#db2777' },
];

// Helper: convert multi-line text to array (for description/tips)
const textToArray = (text: string): string[] => {
  if (!text) return [];
  // If it looks like JSON array, parse it
  if (text.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to line splitting
    }
  }
  // Split by newlines, filter empty lines
  return text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
};

// Helper: convert array to multi-line text
const arrayToText = (arr: string | string[]): string => {
  if (typeof arr === 'string') {
    // Try to parse as JSON array
    if (arr.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(arr);
        if (Array.isArray(parsed)) return parsed.join('\n');
      } catch {
        return arr;
      }
    }
    return arr;
  }
  if (Array.isArray(arr)) return arr.join('\n');
  return '';
};

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
  const [resetting, setResetting] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const api = useAdminApi();

  // Convert form data to display format (array -> text)
  const formDisplay = useMemo(() => ({
    descriptionZh: arrayToText(editForm.descriptionZh || ''),
    descriptionEn: arrayToText(editForm.descriptionEn || ''),
    selfCareTipsZh: arrayToText(editForm.selfCareTipsZh || ''),
    selfCareTipsEn: arrayToText(editForm.selfCareTipsEn || ''),
  }), [editForm.descriptionZh, editForm.descriptionEn, editForm.selfCareTipsZh, editForm.selfCareTipsEn]);

  const handleReset = async () => {
    if (!confirm(t('common.confirmReset'))) return;
    setResetting(true);
    const result = await api.resetGlowtypes();
    if (result) {
      await loadGlowtypes();
      alert(t('common.resetSuccess'));
    } else if (api.error) {
      alert(t('common.resetFailed') + ': ' + api.error);
    }
    setResetting(false);
  };

  const loadGlowtypes = async () => {
    setLoading(true);
    const data = await api.listGlowtypes();
    if (data) setGlowtypes(data);
    setLoading(false);
  };

  useEffect(() => {
    loadGlowtypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEdit = (glowtype: Glowtype) => {
    setEditingId(glowtype.id);
    setEditForm(glowtype);
    setIsCreating(false);
    setPreviewMode(false);
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
      descriptionZh: '',
      descriptionEn: '',
      selfCareTipsZh: '',
      selfCareTipsEn: '',
      disclaimerZh: '',
      disclaimerEn: '',
      primaryColor: '#4f46e5',
      gradient: 'radial-gradient(circle at center, #a5b4fc, #818cf8, #4f46e5, transparent 70%)',
      cardAccent: 'from-indigo-50 to-blue-50',
      textColor: 'text-indigo-900',
    });
    setPreviewMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    // Convert text fields to JSON arrays for description and tips
    const dataToSave = {
      ...editForm,
      descriptionZh: JSON.stringify(textToArray(formDisplay.descriptionZh)),
      descriptionEn: JSON.stringify(textToArray(formDisplay.descriptionEn)),
      selfCareTipsZh: JSON.stringify(textToArray(formDisplay.selfCareTipsZh)),
      selfCareTipsEn: JSON.stringify(textToArray(formDisplay.selfCareTipsEn)),
    };

    if (isCreating) {
      const result = await api.createGlowtype(dataToSave);
      if (result) {
        await loadGlowtypes();
        setIsCreating(false);
        setEditForm({});
      } else if (api.error) {
        setSaveError(api.error);
      }
    } else if (editingId) {
      const result = await api.updateGlowtype(editingId, dataToSave);
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
      } catch {
        alert(t('glowtypes.importFailed'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyColorPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setEditForm({
      ...editForm,
      cardAccent: preset.cardAccent,
      textColor: preset.textColor,
      gradient: preset.gradient,
      primaryColor: preset.primary,
    });
    setShowColorPicker(false);
  };

  // Update text field and sync to form
  const updateTextField = (field: 'descriptionZh' | 'descriptionEn' | 'selfCareTipsZh' | 'selfCareTipsEn', value: string) => {
    setEditForm({ ...editForm, [field]: value });
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
          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition disabled:opacity-50"
            title={t('common.resetToDefaults')}
          >
            <RotateCcw className={`w-4 h-4 ${resetting ? 'animate-spin' : ''}`} />
            {t('common.reset')}
          </button>
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
            <div className="flex justify-center py-8">
              <div className="w-72 aspect-[3/5]">
                <GlowtypeCard
                  data={{
                    title: editForm.nameZh || editForm.nameEn || 'Glowtype Name',
                    tagline: editForm.taglineZh || editForm.taglineEn || 'Tagline here',
                    description: arrayToText(editForm.descriptionZh || editForm.descriptionEn || 'Description here'),
                    auraGradient: editForm.gradient || 'radial-gradient(circle at center, #a5b4fc, #818cf8, #4f46e5, transparent 70%)',
                    cardAccent: editForm.cardAccent || 'from-indigo-50 to-blue-50',
                    textColor: editForm.textColor || 'text-indigo-900',
                  }}
                  lang="zh"
                  animated={false}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Color Preset Picker */}
              <div className="mb-6 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Palette className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">{t('glowtypes.colorPresets')}</span>
                  </div>
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    {showColorPicker ? t('glowtypes.hidePresets') : t('glowtypes.showPresets')}
                  </button>
                </div>
                {showColorPicker && (
                  <div className="grid grid-cols-4 gap-2">
                    {COLOR_PRESETS.map((preset) => (
                      <button
                        key={preset.name}
                        onClick={() => applyColorPreset(preset)}
                        className={`p-3 rounded-lg border-2 transition hover:scale-105 ${
                          editForm.cardAccent === preset.cardAccent
                            ? 'border-purple-500 ring-2 ring-purple-200'
                            : 'border-transparent'
                        }`}
                        style={{ background: preset.gradient }}
                      >
                        <span className="text-white text-xs font-bold drop-shadow">{preset.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-purple-600 mt-2">
                  <Info className="w-3 h-3 inline mr-1" />
                  {t('glowtypes.colorPresetsHint')}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Basic Info */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.typeCode')}</label>
                  <input
                    type="text"
                    value={editForm.typeCode || ''}
                    onChange={(e) => setEditForm({ ...editForm, typeCode: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    placeholder="quiet-comet"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">{t('glowtypes.typeCodeHint')}</p>
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

                {/* Names */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.nameZh')}</label>
                  <input
                    type="text"
                    value={editForm.nameZh || ''}
                    onChange={(e) => setEditForm({ ...editForm, nameZh: e.target.value })}
                    placeholder="静默彗星"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.nameEn')}</label>
                  <input
                    type="text"
                    value={editForm.nameEn || ''}
                    onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                    placeholder="Quiet Comet"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Taglines */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.taglineZh')}</label>
                  <input
                    type="text"
                    value={editForm.taglineZh || ''}
                    onChange={(e) => setEditForm({ ...editForm, taglineZh: e.target.value })}
                    placeholder="外表平静，内心深邃"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.taglineEn')}</label>
                  <input
                    type="text"
                    value={editForm.taglineEn || ''}
                    onChange={(e) => setEditForm({ ...editForm, taglineEn: e.target.value })}
                    placeholder="Calm outside, deep inside"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                  />
                </div>

                {/* Styling - Advanced */}
                <div className="md:col-span-2 p-4 bg-gray-50 rounded-xl space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Palette className="w-4 h-4" />
                    {t('glowtypes.advancedStyling')}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.gradientCss')}</label>
                      <input
                        type="text"
                        value={editForm.gradient || ''}
                        onChange={(e) => setEditForm({ ...editForm, gradient: e.target.value })}
                        placeholder="radial-gradient(circle at center, #a5b4fc, #818cf8, #4f46e5, transparent 70%)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm font-mono"
                      />
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.cardAccent')}</label>
                        <input
                          type="text"
                          value={editForm.cardAccent || ''}
                          onChange={(e) => setEditForm({ ...editForm, cardAccent: e.target.value })}
                          placeholder="from-indigo-50 to-blue-50"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm font-mono"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.textColor')}</label>
                        <input
                          type="text"
                          value={editForm.textColor || ''}
                          onChange={(e) => setEditForm({ ...editForm, textColor: e.target.value })}
                          placeholder="text-indigo-900"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-sm font-mono"
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">
                    <Info className="w-3 h-3 inline mr-1" />
                    {t('glowtypes.stylingHint')}
                  </p>
                </div>

                {/* Descriptions - Multi-line */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('glowtypes.descriptionZh')}
                    <span className="text-gray-400 font-normal ml-2">{t('glowtypes.multiLineHint')}</span>
                  </label>
                  <textarea
                    value={formDisplay.descriptionZh}
                    onChange={(e) => updateTextField('descriptionZh', e.target.value)}
                    placeholder="你更喜欢独处&#10;也习惯把情绪放在心里&#10;你有丰富的内心世界"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('glowtypes.descriptionEn')}
                    <span className="text-gray-400 font-normal ml-2">{t('glowtypes.multiLineHint')}</span>
                  </label>
                  <textarea
                    value={formDisplay.descriptionEn}
                    onChange={(e) => updateTextField('descriptionEn', e.target.value)}
                    placeholder="You prefer solitude&#10;You tend to keep emotions to yourself&#10;You have a rich inner world"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    rows={4}
                  />
                </div>

                {/* Self Care Tips - Multi-line */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('glowtypes.tipsZh')}
                    <span className="text-gray-400 font-normal ml-2">{t('glowtypes.multiLineHint')}</span>
                  </label>
                  <textarea
                    value={formDisplay.selfCareTipsZh}
                    onChange={(e) => updateTextField('selfCareTipsZh', e.target.value)}
                    placeholder="记得给自己留一点独处时间&#10;热情也需要充电"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('glowtypes.tipsEn')}
                    <span className="text-gray-400 font-normal ml-2">{t('glowtypes.multiLineHint')}</span>
                  </label>
                  <textarea
                    value={formDisplay.selfCareTipsEn}
                    onChange={(e) => updateTextField('selfCareTipsEn', e.target.value)}
                    placeholder="Remember to save some alone time&#10;Even enthusiasm needs recharging"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    rows={3}
                  />
                </div>

                {/* Disclaimers */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.disclaimerZh')}</label>
                  <textarea
                    value={editForm.disclaimerZh || ''}
                    onChange={(e) => setEditForm({ ...editForm, disclaimerZh: e.target.value })}
                    placeholder="这只是一个轻量的性格小测试，并不是心理诊断。"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowtypes.disclaimerEn')}</label>
                  <textarea
                    value={editForm.disclaimerEn || ''}
                    onChange={(e) => setEditForm({ ...editForm, disclaimerEn: e.target.value })}
                    placeholder="This is a light personality quiz, not a psychological diagnosis."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                    rows={2}
                  />
                </div>
              </div>
            </>
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

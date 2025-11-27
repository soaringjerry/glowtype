import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Save,
  Loader2,
  RefreshCw,
  Edit2,
  Trash2,
  X,
  BookOpen,
  Sparkles,
  Check
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface Chapter {
  id: number;
  chapterId: string;
  nameZh: string;
  nameEn: string;
  descZh: string;
  descEn: string;
  icon: string;
  color: string;
  order: number;
  isActive: boolean;
}

interface GlowStick {
  id: number;
  titleZh: string;
  titleEn: string;
  messageZh: string;
  messageEn: string;
  color: string;
  chapterId: string;
  forTypes: string;
  order: number;
  isActive: boolean;
}

export default function Glowpedia() {
  const { t } = useTranslation('admin');
  const api = useAdminApi();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [sticks, setSticks] = useState<GlowStick[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chapters' | 'sticks'>('chapters');

  // Edit states
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter> | null>(null);
  const [editingStick, setEditingStick] = useState<Partial<GlowStick> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [chaptersData, sticksData] = await Promise.all([
      api.listChapters(),
      api.listGlowSticks(),
    ]);
    if (chaptersData) setChapters(chaptersData);
    if (sticksData) setSticks(sticksData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chapter handlers
  const handleCreateChapter = () => {
    setIsCreating(true);
    setEditingChapter({
      chapterId: '',
      nameZh: '',
      nameEn: '',
      descZh: '',
      descEn: '',
      icon: '✨',
      color: 'violet',
      order: chapters.length,
      isActive: true,
    });
  };

  const handleEditChapter = (chapter: Chapter) => {
    setIsCreating(false);
    setEditingChapter({ ...chapter });
  };

  const handleSaveChapter = async () => {
    if (!editingChapter) return;
    setSaving(true);
    if (isCreating) {
      await api.createChapter(editingChapter);
    } else if (editingChapter.id) {
      await api.updateChapter(editingChapter.id, editingChapter);
    }
    await loadData();
    setEditingChapter(null);
    setIsCreating(false);
    setSaving(false);
  };

  const handleDeleteChapter = async (id: number) => {
    if (!confirm(t('glowpedia.confirmDelete'))) return;
    await api.deleteChapter(id);
    await loadData();
  };

  // Glow Stick handlers
  const handleCreateStick = () => {
    setIsCreating(true);
    setEditingStick({
      titleZh: '',
      titleEn: '',
      messageZh: '',
      messageEn: '',
      color: 'from-violet-400 to-indigo-500',
      chapterId: chapters[0]?.chapterId || '',
      forTypes: '',
      order: sticks.length,
      isActive: true,
    });
  };

  const handleEditStick = (stick: GlowStick) => {
    setIsCreating(false);
    setEditingStick({ ...stick });
  };

  const handleSaveStick = async () => {
    if (!editingStick) return;
    setSaving(true);
    if (isCreating) {
      await api.createGlowStick(editingStick);
    } else if (editingStick.id) {
      await api.updateGlowStick(editingStick.id, editingStick);
    }
    await loadData();
    setEditingStick(null);
    setIsCreating(false);
    setSaving(false);
  };

  const handleDeleteStick = async (id: number) => {
    if (!confirm(t('glowpedia.confirmDelete'))) return;
    await api.deleteGlowStick(id);
    await loadData();
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
          <h1 className="text-2xl font-bold text-gray-900">{t('glowpedia.title')}</h1>
          <p className="text-gray-500">{t('glowpedia.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh')}
          </button>
          <button
            onClick={activeTab === 'chapters' ? handleCreateChapter : handleCreateStick}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'chapters' ? t('glowpedia.addChapter') : t('glowpedia.addStick')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('chapters')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'chapters'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          {t('glowpedia.chapters')} ({chapters.length})
        </button>
        <button
          onClick={() => setActiveTab('sticks')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'sticks'
              ? 'text-purple-600 border-b-2 border-purple-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sparkles className="w-4 h-4 inline mr-2" />
          {t('glowpedia.glowSticks')} ({sticks.length})
        </button>
      </div>

      {/* Chapter Edit Form */}
      {activeTab === 'chapters' && editingChapter && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {isCreating ? t('glowpedia.createChapter') : t('glowpedia.editChapter')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.chapterId')}</label>
              <input
                type="text"
                value={editingChapter.chapterId || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, chapterId: e.target.value })}
                placeholder="calm"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.icon')}</label>
              <input
                type="text"
                value={editingChapter.icon || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, icon: e.target.value })}
                placeholder="🌙"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.nameZh')}</label>
              <input
                type="text"
                value={editingChapter.nameZh || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, nameZh: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.nameEn')}</label>
              <input
                type="text"
                value={editingChapter.nameEn || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, nameEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.descZh')}</label>
              <input
                type="text"
                value={editingChapter.descZh || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, descZh: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.descEn')}</label>
              <input
                type="text"
                value={editingChapter.descEn || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, descEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.color')}</label>
              <input
                type="text"
                value={editingChapter.color || ''}
                onChange={(e) => setEditingChapter({ ...editingChapter, color: e.target.value })}
                placeholder="indigo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.order')}</label>
              <input
                type="number"
                value={editingChapter.order || 0}
                onChange={(e) => setEditingChapter({ ...editingChapter, order: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSaveChapter}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </button>
            <button
              onClick={() => { setEditingChapter(null); setIsCreating(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Chapters List */}
      {activeTab === 'chapters' && (
        <div className="space-y-4">
          {chapters.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
              {t('glowpedia.noChapters')}
            </div>
          ) : (
            chapters.map((chapter) => (
              <div
                key={chapter.id}
                className={`bg-white rounded-2xl p-4 shadow-sm border transition ${
                  chapter.isActive ? 'border-gray-100 hover:border-purple-200' : 'border-gray-100 opacity-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{chapter.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800">{chapter.nameZh}</span>
                        <span className="text-gray-400">|</span>
                        <span className="text-gray-600">{chapter.nameEn}</span>
                        {chapter.isActive && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs font-medium rounded">
                            <Check className="w-3 h-3 inline" />
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        <code className="bg-gray-100 px-1 rounded">{chapter.chapterId}</code>
                        <span className="mx-2">·</span>
                        {chapter.descZh}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditChapter(chapter)}
                      className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteChapter(chapter.id)}
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
      )}

      {/* Glow Stick Edit Form */}
      {activeTab === 'sticks' && editingStick && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">
            {isCreating ? t('glowpedia.createStick') : t('glowpedia.editStick')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.titleZh')}</label>
              <input
                type="text"
                value={editingStick.titleZh || ''}
                onChange={(e) => setEditingStick({ ...editingStick, titleZh: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.titleEn')}</label>
              <input
                type="text"
                value={editingStick.titleEn || ''}
                onChange={(e) => setEditingStick({ ...editingStick, titleEn: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.messageZh')}</label>
              <textarea
                value={editingStick.messageZh || ''}
                onChange={(e) => setEditingStick({ ...editingStick, messageZh: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.messageEn')}</label>
              <textarea
                value={editingStick.messageEn || ''}
                onChange={(e) => setEditingStick({ ...editingStick, messageEn: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.chapter')}</label>
              <select
                value={editingStick.chapterId || ''}
                onChange={(e) => setEditingStick({ ...editingStick, chapterId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              >
                {chapters.map((ch) => (
                  <option key={ch.chapterId} value={ch.chapterId}>
                    {ch.icon} {ch.nameZh} ({ch.chapterId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.colorGradient')}</label>
              <input
                type="text"
                value={editingStick.color || ''}
                onChange={(e) => setEditingStick({ ...editingStick, color: e.target.value })}
                placeholder="from-violet-400 to-indigo-500"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.forTypes')}</label>
              <input
                type="text"
                value={editingStick.forTypes || ''}
                onChange={(e) => setEditingStick({ ...editingStick, forTypes: e.target.value })}
                placeholder="Quiet Comet, Radiant Nebula"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">{t('glowpedia.forTypesHint')}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('glowpedia.order')}</label>
              <input
                type="number"
                value={editingStick.order || 0}
                onChange={(e) => setEditingStick({ ...editingStick, order: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSaveStick}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </button>
            <button
              onClick={() => { setEditingStick(null); setIsCreating(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
            >
              <X className="w-4 h-4" />
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Glow Sticks List */}
      {activeTab === 'sticks' && (
        <div className="space-y-4">
          {sticks.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center text-gray-400">
              {t('glowpedia.noSticks')}
            </div>
          ) : (
            sticks.map((stick) => {
              const chapter = chapters.find(c => c.chapterId === stick.chapterId);
              return (
                <div
                  key={stick.id}
                  className={`bg-white rounded-2xl p-4 shadow-sm border transition ${
                    stick.isActive ? 'border-gray-100 hover:border-purple-200' : 'border-gray-100 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 text-xs text-white rounded bg-gradient-to-r ${stick.color}`}>
                          {chapter?.icon} {chapter?.nameZh || stick.chapterId}
                        </span>
                        {stick.isActive && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-600 text-xs font-medium rounded">
                            <Check className="w-3 h-3 inline" />
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-gray-800">{stick.titleZh}</div>
                      <div className="text-sm text-gray-500">{stick.titleEn}</div>
                      <div className="mt-2 text-sm text-gray-600 line-clamp-2">{stick.messageZh}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEditStick(stick)}
                        className="p-2 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStick(stick.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

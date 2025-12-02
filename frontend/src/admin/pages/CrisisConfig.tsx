import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Shield,
  Loader2,
  RefreshCw,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Settings,
  Phone,
  MessageSquareOff,
  Sparkles,
  Search,
  RotateCcw,
  Check,
  Filter,
  Globe,
  Wand2,
  MessageSquare,
  Info,
} from 'lucide-react';
import { useAdminApi, useAdminAuth } from '../hooks/useAdmin';
import type {
  CrisisConfigOverview,
  CrisisSettings,
  CrisisKeyword,
  CrisisExcludePattern,
  CrisisResource,
  CrisisForbiddenPhrase,
  CrisisGlowtypeGuidance,
  CrisisScript,
  PromptSlot,
} from '../hooks/useAdmin';
import { FileText } from 'lucide-react';

type TabType = 'overview' | 'prompts' | 'keywords' | 'patterns' | 'resources' | 'phrases' | 'guidance' | 'scripts' | 'settings';

const CRISIS_LEVELS = [
  { value: 1, label: 'Level 1 - Low', color: 'bg-yellow-100 text-yellow-800' },
  { value: 2, label: 'Level 2 - Medium', color: 'bg-orange-100 text-orange-800' },
  { value: 3, label: 'Level 3 - High', color: 'bg-red-100 text-red-800' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
];

const CATEGORIES = [
  { value: 'self-harm', label: 'Self-harm' },
  { value: 'hopelessness', label: 'Hopelessness' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'general', label: 'General' },
];

const PHRASE_CATEGORIES = [
  { value: 'diagnosis', label: 'Diagnosis' },
  { value: 'dismissive', label: 'Dismissive' },
  { value: 'toxic_positivity', label: 'Toxic Positivity' },
  { value: 'invalidating', label: 'Invalidating' },
];

const FIELD_TYPES = [
  { value: 'energyStyle', label: 'Energy Style' },
  { value: 'expressionStyle', label: 'Expression Style' },
  { value: 'metaphor', label: 'Metaphor' },
  { value: 'selfCareTip', label: 'Self Care Tip' },
];

interface GlowtypeOption {
  code: string;
  name: string;
}

export default function CrisisConfig() {
  const { t, i18n } = useTranslation('admin');
  const api = useAdminApi();
  const { currentUser } = useAdminAuth();
  const canResetData = currentUser?.effectivePermissions?.includes('data.reset') ?? false;
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Overview data
  const [overview, setOverview] = useState<CrisisConfigOverview | null>(null);
  const [settings, setSettings] = useState<CrisisSettings | null>(null);

  // List data
  const [keywords, setKeywords] = useState<CrisisKeyword[]>([]);
  const [patterns, setPatterns] = useState<CrisisExcludePattern[]>([]);
  const [resources, setResources] = useState<CrisisResource[]>([]);
  const [phrases, setPhrases] = useState<CrisisForbiddenPhrase[]>([]);
  const [guidance, setGuidance] = useState<CrisisGlowtypeGuidance[]>([]);
  const [scripts, setScripts] = useState<CrisisScript[]>([]);
  const [prompts, setPrompts] = useState<PromptSlot[]>([]);
  const [glowtypes, setGlowtypes] = useState<GlowtypeOption[]>([]);

  // Prompts editing state
  const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
  const [editPromptContent, setEditPromptContent] = useState('');
  const [editPromptActive, setEditPromptActive] = useState(true);
  const [promptSaveError, setPromptSaveError] = useState<string | null>(null);
  const [resettingPrompt, setResettingPrompt] = useState<string | null>(null);

  // Filters
  const [keywordLevelFilter, setKeywordLevelFilter] = useState<number | undefined>();
  const [keywordLangFilter, setKeywordLangFilter] = useState<string | undefined>();
  const [resourceCountryFilter, setResourceCountryFilter] = useState<string | undefined>();
  const [phraseLangFilter, setPhraseLangFilter] = useState<string | undefined>();
  const [guidanceGlowtypeFilter, setGuidanceGlowtypeFilter] = useState<string | undefined>();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'keyword' | 'pattern' | 'resource' | 'phrase' | 'guidance' | 'script' | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Embedding stats state
  const [embeddingStats, setEmbeddingStats] = useState<{ total: number; withEmbedding: number; percentage: number } | null>(null);
  const [refreshingEmbeddings, setRefreshingEmbeddings] = useState(false);

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'overview', label: t('crisis.tabs.overview', 'Overview'), icon: Shield },
    { key: 'prompts', label: t('crisis.tabs.prompts', 'AI Prompts'), icon: Wand2 },
    { key: 'keywords', label: t('crisis.tabs.keywords', 'Keywords'), icon: AlertTriangle },
    { key: 'patterns', label: t('crisis.tabs.patterns', 'Exclude Patterns'), icon: Search },
    { key: 'resources', label: t('crisis.tabs.resources', 'Resources'), icon: Phone },
    { key: 'phrases', label: t('crisis.tabs.phrases', 'Forbidden Phrases'), icon: MessageSquareOff },
    { key: 'guidance', label: t('crisis.tabs.guidance', 'Glowtype Guidance'), icon: Sparkles },
    { key: 'scripts', label: t('crisis.tabs.scripts', 'Scripts'), icon: FileText },
    { key: 'settings', label: t('crisis.tabs.settings', 'Settings'), icon: Settings },
  ];

  const loadOverview = async () => {
    const data = await api.getCrisisOverview();
    if (data) setOverview(data);
  };

  const loadSettings = async () => {
    const data = await api.getCrisisSettings();
    if (data) setSettings(data);
  };

  const loadKeywords = async () => {
    const data = await api.listCrisisKeywords({ level: keywordLevelFilter, language: keywordLangFilter });
    if (data) setKeywords(data);
  };

  const loadPatterns = async () => {
    const data = await api.listCrisisPatterns();
    if (data) setPatterns(data);
  };

  const loadResources = async () => {
    const data = await api.listCrisisResources(resourceCountryFilter);
    if (data) setResources(data);
  };

  const loadPhrases = async () => {
    const data = await api.listCrisisPhrases(phraseLangFilter);
    if (data) setPhrases(data);
  };

  const loadGuidance = async () => {
    const data = await api.listCrisisGuidance({ glowtypeCode: guidanceGlowtypeFilter });
    if (data) setGuidance(data);
  };

  const loadScripts = async () => {
    const data = await api.listCrisisScripts();
    if (data) setScripts(data);
  };

  const loadEmbeddingStats = async () => {
    const data = await api.getEmbeddingStats();
    if (data) setEmbeddingStats(data);
  };

  const handleRefreshEmbeddings = async () => {
    setRefreshingEmbeddings(true);
    const result = await api.refreshEmbeddings();
    if (result) {
      // Reload stats after refresh
      await loadEmbeddingStats();
    }
    setRefreshingEmbeddings(false);
  };

  const loadPrompts = async () => {
    const data = await api.listPrompts();
    if (data) setPrompts(data);
  };

  const loadGlowtypes = async () => {
    const data = await api.listGlowtypes();
    if (data) {
      // Transform to simple format for dropdowns
      setGlowtypes(
        data.map((g: any) => ({
          code: g.typeCode,
          name: (i18n.language.startsWith('zh') ? g.nameZh : g.nameEn) || g.nameZh || g.nameEn || g.typeCode,
        }))
      );
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadOverview(), loadSettings(), loadGlowtypes()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'prompts') loadPrompts();
    else if (activeTab === 'keywords') loadKeywords();
    else if (activeTab === 'patterns') loadPatterns();
    else if (activeTab === 'resources') loadResources();
    else if (activeTab === 'phrases') loadPhrases();
    else if (activeTab === 'guidance') loadGuidance();
    else if (activeTab === 'scripts') {
      loadScripts();
      loadEmbeddingStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, keywordLevelFilter, keywordLangFilter, resourceCountryFilter, phraseLangFilter, guidanceGlowtypeFilter]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    const result = await api.updateCrisisSettings(settings);
    if (result) {
      setSettings(result);
      alert(t('common.saveSuccess', 'Saved successfully'));
    }
    setSaving(false);
  };

  const handleResetAll = async () => {
    if (!confirm(t('crisis.confirmResetAll', 'Reset all crisis config to defaults?'))) return;
    setSaving(true);
    const result = await api.resetCrisisConfig({ all: true });
    if (result) {
      await loadAll();
      alert(t('common.resetSuccess', 'Reset complete'));
    }
    setSaving(false);
  };

  // Prompt handlers
  const handleEditPrompt = (slot: PromptSlot) => {
    setEditingPromptKey(slot.key);
    setEditPromptContent(slot.currentContent);
    setEditPromptActive(slot.isActive);
    setPromptSaveError(null);
  };

  const handleSavePrompt = async () => {
    if (!editingPromptKey) return;
    setSaving(true);
    setPromptSaveError(null);
    const result = await api.updatePrompt(editingPromptKey, {
      content: editPromptContent,
      isActive: editPromptActive,
    });
    if (result) {
      await loadPrompts();
      setEditingPromptKey(null);
    } else if (api.error) {
      setPromptSaveError(api.error);
    }
    setSaving(false);
  };

  const handleResetPrompt = async (key: string) => {
    if (!confirm(t('prompts.confirmReset', 'Reset this prompt to default?'))) return;
    setResettingPrompt(key);
    const result = await api.resetPrompt(key);
    if (result) {
      await loadPrompts();
    }
    setResettingPrompt(null);
  };

  const getPromptIcon = (key: string) => {
    if (key.includes('insight')) return Sparkles;
    if (key.includes('chat')) return MessageSquare;
    return Wand2;
  };

  const getPromptCategory = (key: string) => {
    if (key.includes('insight')) return t('prompts.category.cosmicInsight', 'Cosmic Insight');
    if (key.includes('chat')) return t('prompts.category.chat', 'Chat');
    return t('prompts.category.other', 'Other');
  };

  const getPromptLanguage = (key: string) => {
    if (key.endsWith('_en')) return 'EN';
    if (key.endsWith('_zh')) return 'ZH';
    return '';
  };

  const openCreateModal = (type: typeof modalType) => {
    setModalType(type);
    setEditingItem(null);
    setModalOpen(true);
  };

  const openEditModal = (type: typeof modalType, item: any) => {
    setModalType(type);
    setEditingItem(item);
    setModalOpen(true);
  };

  const handleDelete = async (type: string, id: number) => {
    if (!confirm(t('common.confirmDelete', 'Delete this item?'))) return;
    let result;
    if (type === 'keyword') result = await api.deleteCrisisKeyword(id);
    else if (type === 'pattern') result = await api.deleteCrisisPattern(id);
    else if (type === 'resource') result = await api.deleteCrisisResource(id);
    else if (type === 'phrase') result = await api.deleteCrisisPhrase(id);
    else if (type === 'guidance') result = await api.deleteCrisisGuidance(id);
    else if (type === 'script') result = await api.deleteCrisisScript(id);

    if (result) {
      await loadOverview();
      if (type === 'keyword') await loadKeywords();
      else if (type === 'pattern') await loadPatterns();
      else if (type === 'resource') await loadResources();
      else if (type === 'phrase') await loadPhrases();
      else if (type === 'guidance') await loadGuidance();
      else if (type === 'script') await loadScripts();
    }
  };

  const handleModalSave = async (data: any) => {
    setSaving(true);
    let result;

    if (modalType === 'keyword') {
      result = editingItem
        ? await api.updateCrisisKeyword(editingItem.id, data)
        : await api.createCrisisKeyword(data);
      if (result) await loadKeywords();
    } else if (modalType === 'pattern') {
      result = editingItem
        ? await api.updateCrisisPattern(editingItem.id, data)
        : await api.createCrisisPattern(data);
      if (result) await loadPatterns();
    } else if (modalType === 'resource') {
      result = editingItem
        ? await api.updateCrisisResource(editingItem.id, data)
        : await api.createCrisisResource(data);
      if (result) await loadResources();
    } else if (modalType === 'phrase') {
      result = editingItem
        ? await api.updateCrisisPhrase(editingItem.id, data)
        : await api.createCrisisPhrase(data);
      if (result) await loadPhrases();
    } else if (modalType === 'guidance') {
      result = editingItem
        ? await api.updateCrisisGuidance(editingItem.id, data)
        : await api.createCrisisGuidance(data);
      if (result) await loadGuidance();
    } else if (modalType === 'script') {
      result = editingItem
        ? await api.updateCrisisScript(editingItem.id, data)
        : await api.createCrisisScript(data);
      if (result) await loadScripts();
    }

    if (result) {
      await loadOverview();
      setModalOpen(false);
    }
    setSaving(false);
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
          <h1 className="text-2xl font-bold text-gray-900">{t('crisis.title', 'Crisis Configuration')}</h1>
          <p className="text-gray-500">{t('crisis.subtitle', 'Configure crisis detection and response settings')}</p>
        </div>
        <div className="flex items-center gap-2">
          {overview && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
              {t('crisis.configVersion', 'Version')}: {overview.configVersion}
            </span>
          )}
          {canResetData && (
            <button
              onClick={handleResetAll}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-xl hover:bg-red-50 transition disabled:opacity-50"
            >
              <RotateCcw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              {t('common.resetAll', 'Reset All')}
            </button>
          )}
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap transition ${
                activeTab === tab.key
                  ? 'bg-purple-500 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {activeTab === 'overview' && overview && (
          <OverviewTab overview={overview} />
        )}
        {activeTab === 'prompts' && (
          <PromptsTab
            prompts={prompts}
            editingKey={editingPromptKey}
            editContent={editPromptContent}
            editActive={editPromptActive}
            saveError={promptSaveError}
            saving={saving}
            resettingKey={resettingPrompt}
            setEditContent={setEditPromptContent}
            setEditActive={setEditPromptActive}
            onEdit={handleEditPrompt}
            onSave={handleSavePrompt}
            onCancel={() => setEditingPromptKey(null)}
            onReset={handleResetPrompt}
            getIcon={getPromptIcon}
            getCategory={getPromptCategory}
            getLanguage={getPromptLanguage}
            t={t}
          />
        )}
        {activeTab === 'keywords' && (
          <KeywordsTab
            keywords={keywords}
            levelFilter={keywordLevelFilter}
            langFilter={keywordLangFilter}
            setLevelFilter={setKeywordLevelFilter}
            setLangFilter={setKeywordLangFilter}
            onCreate={() => openCreateModal('keyword')}
            onEdit={(item) => openEditModal('keyword', item)}
            onDelete={(id) => handleDelete('keyword', id)}
          />
        )}
        {activeTab === 'patterns' && (
          <PatternsTab
            patterns={patterns}
            onCreate={() => openCreateModal('pattern')}
            onEdit={(item) => openEditModal('pattern', item)}
            onDelete={(id) => handleDelete('pattern', id)}
          />
        )}
        {activeTab === 'resources' && (
          <ResourcesTab
            resources={resources}
            countryFilter={resourceCountryFilter}
            setCountryFilter={setResourceCountryFilter}
            onCreate={() => openCreateModal('resource')}
            onEdit={(item) => openEditModal('resource', item)}
            onDelete={(id) => handleDelete('resource', id)}
          />
        )}
        {activeTab === 'phrases' && (
          <PhrasesTab
            phrases={phrases}
            langFilter={phraseLangFilter}
            setLangFilter={setPhraseLangFilter}
            onCreate={() => openCreateModal('phrase')}
            onEdit={(item) => openEditModal('phrase', item)}
            onDelete={(id) => handleDelete('phrase', id)}
          />
        )}
        {activeTab === 'guidance' && (
          <GuidanceTab
            guidance={guidance}
            glowtypes={glowtypes}
            glowtypeFilter={guidanceGlowtypeFilter}
            setGlowtypeFilter={setGuidanceGlowtypeFilter}
            onCreate={() => openCreateModal('guidance')}
            onEdit={(item) => openEditModal('guidance', item)}
            onDelete={(id) => handleDelete('guidance', id)}
          />
        )}
        {activeTab === 'scripts' && (
          <ScriptsTab
            scripts={scripts}
            onCreate={() => openCreateModal('script')}
            onEdit={(item) => openEditModal('script', item)}
            onDelete={(id) => handleDelete('script', id)}
            embeddingStats={embeddingStats}
            onRefreshEmbeddings={handleRefreshEmbeddings}
            refreshingEmbeddings={refreshingEmbeddings}
          />
        )}
        {activeTab === 'settings' && settings && (
          <SettingsTab
            settings={settings}
            setSettings={setSettings}
            onSave={handleSaveSettings}
            saving={saving}
          />
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <EditModal
          type={modalType}
          item={editingItem}
          glowtypes={glowtypes}
          onClose={() => setModalOpen(false)}
          onSave={handleModalSave}
          saving={saving}
        />
      )}
    </div>
  );
}

// ============ Tab Components ============

function OverviewTab({ overview }: { overview: CrisisConfigOverview }) {
  const { t } = useTranslation('admin');

  const stats = [
    { label: t('crisis.overview.keywords', 'Keywords'), value: overview.keywords, color: 'bg-red-500' },
    { label: t('crisis.overview.patterns', 'Exclude Patterns'), value: overview.excludePatterns, color: 'bg-orange-500' },
    { label: t('crisis.overview.resources', 'Resources'), value: overview.resources, color: 'bg-green-500' },
    { label: t('crisis.overview.phrases', 'Forbidden Phrases'), value: overview.forbiddenPhrases, color: 'bg-blue-500' },
    { label: t('crisis.overview.guidance', 'Glowtype Guidance'), value: overview.glowtypeGuidance, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-gray-50 rounded-xl p-4 text-center">
            <div className={`w-12 h-12 mx-auto rounded-xl ${stat.color} flex items-center justify-center text-white text-xl font-bold mb-2`}>
              {stat.value}
            </div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <p className="font-medium">{t('crisis.overview.hotReloadNote', 'Hot Reload Enabled')}</p>
        <p className="mt-1">{t('crisis.overview.hotReloadDesc', 'Changes made here will take effect immediately without server restart.')}</p>
      </div>
    </div>
  );
}

function KeywordsTab({
  keywords,
  levelFilter,
  langFilter,
  setLevelFilter,
  setLangFilter,
  onCreate,
  onEdit,
  onDelete,
}: {
  keywords: CrisisKeyword[];
  levelFilter?: number;
  langFilter?: string;
  setLevelFilter: (v?: number) => void;
  setLangFilter: (v?: string) => void;
  onCreate: () => void;
  onEdit: (item: CrisisKeyword) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={levelFilter ?? ''}
            onChange={(e) => setLevelFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">{t('crisis.filter.allLevels', 'All Levels')}</option>
            {CRISIS_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <select
            value={langFilter ?? ''}
            onChange={(e) => setLangFilter(e.target.value || undefined)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">{t('crisis.filter.allLanguages', 'All Languages')}</option>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onCreate}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          {t('common.add', 'Add')}
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 px-4">{t('crisis.keyword.keyword', 'Keyword')}</th>
              <th className="text-left py-3 px-4">{t('crisis.keyword.level', 'Level')}</th>
              <th className="text-left py-3 px-4">{t('crisis.keyword.language', 'Language')}</th>
              <th className="text-left py-3 px-4">{t('crisis.keyword.category', 'Category')}</th>
              <th className="text-left py-3 px-4">{t('crisis.keyword.slang', 'Slang')}</th>
              <th className="text-left py-3 px-4">{t('common.status', 'Status')}</th>
              <th className="text-right py-3 px-4">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw) => {
              const level = CRISIS_LEVELS.find((l) => l.value === kw.level);
              return (
                <tr key={kw.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{kw.keyword}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${level?.color || ''}`}>
                      L{kw.level}
                    </span>
                  </td>
                  <td className="py-3 px-4 uppercase">{kw.language}</td>
                  <td className="py-3 px-4">{kw.category}</td>
                  <td className="py-3 px-4">
                    {kw.isSlang && (
                      <span className="text-xs text-gray-500">→ {kw.slangFor}</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {kw.isActive ? (
                      <span className="text-green-600 flex items-center gap-1"><Check className="w-3 h-3" /> Active</span>
                    ) : (
                      <span className="text-gray-400">Inactive</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => onEdit(kw)} className="p-1 text-gray-400 hover:text-purple-500"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => onDelete(kw.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {keywords.length === 0 && (
        <div className="text-center py-8 text-gray-400">{t('common.noData', 'No data')}</div>
      )}
    </div>
  );
}

function PatternsTab({
  patterns,
  onCreate,
  onEdit,
  onDelete,
}: {
  patterns: CrisisExcludePattern[];
  onCreate: () => void;
  onEdit: (item: CrisisExcludePattern) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          {t('common.add', 'Add')}
        </button>
      </div>

      <div className="space-y-2">
        {patterns.map((p) => (
          <div key={p.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="flex-1">
              <div className="font-mono text-sm">{p.pattern}</div>
              <div className="text-xs text-gray-500 mt-1">{p.description} • {p.language.toUpperCase()} • {p.patternType}</div>
            </div>
            <div className="flex items-center gap-2">
              {p.isActive ? (
                <span className="text-green-600 text-xs"><Check className="w-3 h-3 inline" /> Active</span>
              ) : (
                <span className="text-gray-400 text-xs">Inactive</span>
              )}
              <button onClick={() => onEdit(p)} className="p-1 text-gray-400 hover:text-purple-500"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => onDelete(p.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {patterns.length === 0 && (
        <div className="text-center py-8 text-gray-400">{t('common.noData', 'No data')}</div>
      )}
    </div>
  );
}

function ResourcesTab({
  resources,
  countryFilter,
  setCountryFilter,
  onCreate,
  onEdit,
  onDelete,
}: {
  resources: CrisisResource[];
  countryFilter?: string;
  setCountryFilter: (v?: string) => void;
  onCreate: () => void;
  onEdit: (item: CrisisResource) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('admin');
  const countries = [...new Set(resources.map((r) => r.country))].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <select
            value={countryFilter ?? ''}
            onChange={(e) => setCountryFilter(e.target.value || undefined)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="">{t('crisis.filter.allCountries', 'All Countries')}</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <button
          onClick={onCreate}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          {t('common.add', 'Add')}
        </button>
      </div>

      <div className="grid gap-4">
        {resources.map((r) => (
          <div key={r.id} className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl">
            <div className="w-10 h-10 bg-green-500 text-white rounded-lg flex items-center justify-center text-xs font-bold">
              {r.country}
            </div>
            <div className="flex-1">
              <div className="font-medium">{r.name}</div>
              {r.nameZh && <div className="text-sm text-gray-600">{r.nameZh}</div>}
              <div className="text-sm text-gray-500 mt-1">
                {r.phone && <span className="mr-3">{r.phone}</span>}
                {r.hours && <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{r.hours}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">P{r.priority}</span>
              <button onClick={() => onEdit(r)} className="p-1 text-gray-400 hover:text-purple-500"><Edit2 className="w-4 h-4" /></button>
              <button onClick={() => onDelete(r.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      {resources.length === 0 && (
        <div className="text-center py-8 text-gray-400">{t('common.noData', 'No data')}</div>
      )}
    </div>
  );
}

function PhrasesTab({
  phrases,
  langFilter,
  setLangFilter,
  onCreate,
  onEdit,
  onDelete,
}: {
  phrases: CrisisForbiddenPhrase[];
  langFilter?: string;
  setLangFilter: (v?: string) => void;
  onCreate: () => void;
  onEdit: (item: CrisisForbiddenPhrase) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          value={langFilter ?? ''}
          onChange={(e) => setLangFilter(e.target.value || undefined)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">{t('crisis.filter.allLanguages', 'All Languages')}</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <button
          onClick={onCreate}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          {t('common.add', 'Add')}
        </button>
      </div>

      <div className="space-y-2">
        {phrases.map((p) => (
          <div key={p.id} className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-red-600">"{p.phrase}"</div>
                {p.alternative && (
                  <div className="text-sm text-green-600 mt-1">→ "{p.alternative}"</div>
                )}
                <div className="text-xs text-gray-400 mt-2">{p.language.toUpperCase()} • {p.category}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEdit(p)} className="p-1 text-gray-400 hover:text-purple-500"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => onDelete(p.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {phrases.length === 0 && (
        <div className="text-center py-8 text-gray-400">{t('common.noData', 'No data')}</div>
      )}
    </div>
  );
}

function GuidanceTab({
  guidance,
  glowtypes,
  glowtypeFilter,
  setGlowtypeFilter,
  onCreate,
  onEdit,
  onDelete,
}: {
  guidance: CrisisGlowtypeGuidance[];
  glowtypes: GlowtypeOption[];
  glowtypeFilter?: string;
  setGlowtypeFilter: (v?: string) => void;
  onCreate: () => void;
  onEdit: (item: CrisisGlowtypeGuidance) => void;
  onDelete: (id: number) => void;
}) {
  const { t } = useTranslation('admin');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <select
          value={glowtypeFilter ?? ''}
          onChange={(e) => setGlowtypeFilter(e.target.value || undefined)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">{t('crisis.filter.allGlowtypes', 'All Glowtypes')}</option>
          {glowtypes.map((g) => (
            <option key={g.code} value={g.code}>{g.name}</option>
          ))}
        </select>
        <button
          onClick={onCreate}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          {t('common.add', 'Add')}
        </button>
      </div>

      <div className="space-y-2">
        {guidance.map((g) => (
          <div key={g.id} className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">{g.glowtypeCode}</span>
                  <span className="text-xs text-gray-400">{g.language.toUpperCase()}</span>
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{g.fieldType}</span>
                </div>
                <div className="text-sm">{g.content}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEdit(g)} className="p-1 text-gray-400 hover:text-purple-500"><Edit2 className="w-4 h-4" /></button>
                <button onClick={() => onDelete(g.id)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {guidance.length === 0 && (
        <div className="text-center py-8 text-gray-400">{t('common.noData', 'No data')}</div>
      )}
    </div>
  );
}

function ScriptsTab({
  scripts,
  onCreate,
  onEdit,
  onDelete,
  embeddingStats,
  onRefreshEmbeddings,
  refreshingEmbeddings,
}: {
  scripts: CrisisScript[];
  onCreate: () => void;
  onEdit: (item: CrisisScript) => void;
  onDelete: (id: number) => void;
  embeddingStats: { total: number; withEmbedding: number; percentage: number } | null;
  onRefreshEmbeddings: () => void;
  refreshingEmbeddings: boolean;
}) {
  const { t } = useTranslation('admin');
  const allVectorized = embeddingStats?.withEmbedding === embeddingStats?.total;

  return (
    <div className="space-y-4">
      {/* Embedding status banner */}
      {embeddingStats && embeddingStats.total > 0 && (
        <div className={`rounded-xl p-4 text-sm flex items-center justify-between ${
          allVectorized
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-yellow-50 border border-yellow-200 text-yellow-700'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              allVectorized ? 'bg-green-100' : 'bg-yellow-100'
            }`}>
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium">
                {t('crisis.script.embeddingStatus', 'RAG Embedding Status')}
              </p>
              <p className="text-xs mt-0.5">
                {allVectorized ? (
                  <>
                    {embeddingStats.withEmbedding}/{embeddingStats.total} {t('crisis.script.scriptsVectorized', 'scripts vectorized')}
                    <span className="ml-2 font-medium text-green-700">
                      {t('crisis.script.allVectorized', 'All embeddings completed')}
                    </span>
                  </>
                ) : (
                  <>
                    {embeddingStats.withEmbedding}/{embeddingStats.total} {t('crisis.script.scriptsVectorized', 'scripts vectorized')}
                  <span className="ml-2">
                    ({embeddingStats.total - embeddingStats.withEmbedding} {t('crisis.script.pending', 'pending')})
                  </span>
                  </>
                )}
              </p>
            </div>
          </div>
          {!allVectorized && (
            <button
              onClick={onRefreshEmbeddings}
              disabled={refreshingEmbeddings}
              className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 hover:bg-yellow-200 rounded-lg transition text-yellow-800 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshingEmbeddings ? 'animate-spin' : ''}`} />
              {refreshingEmbeddings ? t('common.processing', 'Processing...') : t('crisis.script.generateEmbeddings', 'Generate')}
            </button>
          )}
        </div>
      )}

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Expert-Reviewed Conversation Scripts</p>
          <p className="mt-1">
            <strong>Template mode:</strong> AI sends directly without modification.
            <strong className="ml-2">Reference mode:</strong> AI uses as knowledge base (RAG).
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          {t('crisis.script.add', 'Add Script')}
        </button>
      </div>

      <div className="space-y-3">
        {scripts.map((s) => (
          <div key={s.id} className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                    s.mode === 'template'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {s.mode === 'template' ? t('crisis.script.modeTemplate', 'Template') : t('crisis.script.modeReference', 'Reference')}
                  </span>
                  <span className="text-xs text-gray-400">{s.language?.toUpperCase() || 'ZH'}</span>
                  {s.category && (
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">{s.category}</span>
                  )}
                  {!s.isActive && (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Inactive</span>
                  )}
                </div>
                <div className="font-medium text-gray-900">{s.title}</div>
                <div className="text-sm text-gray-500 mt-1 line-clamp-2">{s.content}</div>
                {s.triggerKeywords && (
                  <div className="text-xs text-gray-400 mt-2">
                    Triggers: {s.triggerKeywords}
                  </div>
                )}
                {s.crisisLevels && (
                  <div className="text-xs text-gray-400">
                    Levels: {s.crisisLevels}
                  </div>
                )}
                {s.approvedBy && (
                  <div className="text-xs text-green-600 mt-1">
                    ✓ Approved by {s.approvedBy}
                  </div>
                )}
              </div>
              <div className="flex gap-1 ml-4">
                <button onClick={() => onEdit(s)} className="p-1 text-gray-400 hover:text-purple-500">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(s.id)} className="p-1 text-gray-400 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {scripts.length === 0 && (
        <div className="text-center py-8 text-gray-400">{t('crisis.script.empty', 'No scripts yet. Click "Add Script" to create one.')}</div>
      )}
    </div>
  );
}

function SettingsTab({
  settings,
  setSettings,
  onSave,
  saving,
}: {
  settings: CrisisSettings;
  setSettings: (s: CrisisSettings) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation('admin');

  const update = (field: keyof CrisisSettings, value: any) => {
    setSettings({ ...settings, [field]: value });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Detection Settings */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">{t('crisis.settings.detection', 'Detection Settings')}</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enableKeywordDetection}
              onChange={(e) => update('enableKeywordDetection', e.target.checked)}
              className="rounded text-purple-500"
            />
            <span>{t('crisis.settings.enableKeyword', 'Enable keyword detection')}</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enablePatternDetection}
              onChange={(e) => update('enablePatternDetection', e.target.checked)}
              className="rounded text-purple-500"
            />
            <span>{t('crisis.settings.enablePattern', 'Enable pattern detection')}</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.enableMLDetection}
              onChange={(e) => update('enableMLDetection', e.target.checked)}
              className="rounded text-purple-500"
            />
            <span>{t('crisis.settings.enableML', 'Enable ML detection (future)')}</span>
          </label>
          <div className="pt-2 border-t border-gray-200 mt-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.enableGlowtypeGuidance !== false}
                onChange={(e) => update('enableGlowtypeGuidance', e.target.checked)}
                className="rounded text-purple-500"
              />
              <div>
                <span className="block">{t('crisis.settings.enableGlowtypeGuidance', 'Enable Glowtype Guidance')}</span>
                <span className="text-xs text-gray-500">{t('crisis.settings.enableGlowtypeGuidanceHint', 'When enabled, AI responses will be personalized based on user\'s Glowtype')}</span>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Session Settings */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">{t('crisis.settings.session', 'Session Settings')}</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('crisis.settings.sessionTTL', 'Session TTL (minutes)')}</label>
            <input
              type="number"
              value={settings.sessionTTLMinutes}
              onChange={(e) => update('sessionTTLMinutes', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('crisis.settings.maxHistory', 'Max history messages')}</label>
            <input
              type="number"
              value={settings.maxHistoryMessages}
              onChange={(e) => update('maxHistoryMessages', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">{t('crisis.settings.maxResourceShows', 'Max resource shows per session')}</label>
            <input
              type="number"
              value={settings.maxResourceShowsPerSession}
              onChange={(e) => update('maxResourceShowsPerSession', parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Alert Settings */}
      <div>
        <h3 className="font-semibold text-gray-800 mb-4">{t('crisis.settings.alerts', 'Level 3 Alert Settings')}</h3>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.level3AlertEnabled}
              onChange={(e) => update('level3AlertEnabled', e.target.checked)}
              className="rounded text-purple-500"
            />
            <span>{t('crisis.settings.enableL3Alert', 'Enable Level 3 alerts')}</span>
          </label>
          {settings.level3AlertEnabled && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t('crisis.settings.alertEmail', 'Alert email')}</label>
                <input
                  type="email"
                  value={settings.level3AlertEmail}
                  onChange={(e) => update('level3AlertEmail', e.target.value)}
                  placeholder="alert@example.com"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">{t('crisis.settings.alertWebhook', 'Alert webhook URL')}</label>
                <input
                  type="url"
                  value={settings.level3AlertWebhook}
                  onChange={(e) => update('level3AlertWebhook', e.target.value)}
                  placeholder="https://hooks.slack.com/..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {t('common.save', 'Save')}
        </button>
      </div>
    </div>
  );
}

// ============ Edit Modal ============

function EditModal({
  type,
  item,
  glowtypes,
  onClose,
  onSave,
  saving,
}: {
  type: 'keyword' | 'pattern' | 'resource' | 'phrase' | 'guidance' | 'script' | null;
  item: any;
  glowtypes: GlowtypeOption[];
  onClose: () => void;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const { t } = useTranslation('admin');
  const [formData, setFormData] = useState<any>(item || {});

  useEffect(() => {
    setFormData(item || {});
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const update = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 text-lg">
                {item ? t('common.edit', 'Edit') : t('common.add', 'Add')} {type}
              </h3>
              <button type="button" onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {type === 'keyword' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Keyword *</label>
                    <input
                      type="text"
                      value={formData.keyword || ''}
                      onChange={(e) => update('keyword', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Level *</label>
                      <select
                        value={formData.level || 1}
                        onChange={(e) => update('level', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        {CRISIS_LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Language *</label>
                      <select
                        value={formData.language || 'en'}
                        onChange={(e) => update('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Category</label>
                    <select
                      value={formData.category || ''}
                      onChange={(e) => update('category', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      <option value="">Select...</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isSlang || false}
                      onChange={(e) => update('isSlang', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Is slang</span>
                  </label>
                  {formData.isSlang && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Slang for</label>
                      <input
                        type="text"
                        value={formData.slangFor || ''}
                        onChange={(e) => update('slangFor', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => update('isActive', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </>
              )}

              {type === 'pattern' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Pattern *</label>
                    <input
                      type="text"
                      value={formData.pattern || ''}
                      onChange={(e) => update('pattern', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Type</label>
                      <select
                        value={formData.patternType || 'contains'}
                        onChange={(e) => update('patternType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        <option value="contains">Contains</option>
                        <option value="regex">Regex</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Language</label>
                      <select
                        value={formData.language || 'en'}
                        onChange={(e) => update('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Description</label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={(e) => update('description', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => update('isActive', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </>
              )}

              {type === 'resource' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Country Code *</label>
                      <input
                        type="text"
                        value={formData.country || ''}
                        onChange={(e) => update('country', e.target.value.toUpperCase())}
                        required
                        placeholder="CN, US, SG..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg uppercase"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Priority</label>
                      <input
                        type="number"
                        value={formData.priority || 100}
                        onChange={(e) => update('priority', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Name (EN) *</label>
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => update('name', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Name (ZH)</label>
                    <input
                      type="text"
                      value={formData.nameZh || ''}
                      onChange={(e) => update('nameZh', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Phone</label>
                    <input
                      type="text"
                      value={formData.phone || ''}
                      onChange={(e) => update('phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">URL</label>
                    <input
                      type="url"
                      value={formData.url || ''}
                      onChange={(e) => update('url', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Hours</label>
                    <input
                      type="text"
                      value={formData.hours || ''}
                      onChange={(e) => update('hours', e.target.value)}
                      placeholder="24/7"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => update('isActive', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </>
              )}

              {type === 'phrase' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Forbidden Phrase *</label>
                    <input
                      type="text"
                      value={formData.phrase || ''}
                      onChange={(e) => update('phrase', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Alternative</label>
                    <input
                      type="text"
                      value={formData.alternative || ''}
                      onChange={(e) => update('alternative', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Language *</label>
                      <select
                        value={formData.language || 'en'}
                        onChange={(e) => update('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Category</label>
                      <select
                        value={formData.category || ''}
                        onChange={(e) => update('category', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        <option value="">Select...</option>
                        {PHRASE_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => update('isActive', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </>
              )}

              {type === 'guidance' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Glowtype *</label>
                      <select
                        value={formData.glowtypeCode || ''}
                        onChange={(e) => update('glowtypeCode', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        <option value="">Select...</option>
                        {glowtypes.map((g) => (
                          <option key={g.code} value={g.code}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Language *</label>
                      <select
                        value={formData.language || 'en'}
                        onChange={(e) => update('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Field Type *</label>
                      <select
                        value={formData.fieldType || ''}
                        onChange={(e) => update('fieldType', e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        <option value="">Select...</option>
                        {FIELD_TYPES.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Display Order</label>
                      <input
                        type="number"
                        value={formData.displayOrder || 0}
                        onChange={(e) => update('displayOrder', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Content *</label>
                    <textarea
                      value={formData.content || ''}
                      onChange={(e) => update('content', e.target.value)}
                      required
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => update('isActive', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </>
              )}

              {type === 'script' && (
                <>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.title', 'Title')} *</label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => update('title', e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.mode', 'Mode')} *</label>
                      <select
                        value={formData.mode || 'reference'}
                        onChange={(e) => update('mode', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        <option value="template">{t('crisis.script.modeTemplate', 'Template')} - AI sends directly</option>
                        <option value="reference">{t('crisis.script.modeReference', 'Reference')} - RAG knowledge</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.language', 'Language')}</label>
                      <select
                        value={formData.language || 'zh'}
                        onChange={(e) => update('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.content', 'Content')} *</label>
                    <textarea
                      value={formData.content || ''}
                      onChange={(e) => update('content', e.target.value)}
                      required
                      rows={5}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.category', 'Category')}</label>
                    <input
                      type="text"
                      value={formData.category || ''}
                      onChange={(e) => update('category', e.target.value)}
                      placeholder="e.g., empathy, validation, referral"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.triggerKeywords', 'Trigger Keywords')}</label>
                      <input
                        type="text"
                        value={formData.triggerKeywords || ''}
                        onChange={(e) => update('triggerKeywords', e.target.value)}
                        placeholder='["keyword1", "keyword2"]'
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.crisisLevels', 'Crisis Levels')}</label>
                      <input
                        type="text"
                        value={formData.crisisLevels || ''}
                        onChange={(e) => update('crisisLevels', e.target.value)}
                        placeholder="e.g., [1,2,3]"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.triggerExamples', 'Trigger Examples (for RAG)')}</label>
                    <textarea
                      value={formData.triggerExamples || ''}
                      onChange={(e) => update('triggerExamples', e.target.value)}
                      rows={2}
                      placeholder='["我想死", "不想活了", "活着太累了"]'
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    />
                    <div className="text-xs text-gray-400 mt-1">JSON array of example user inputs that should match this script</div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.displayOrder', 'Display Order')}</label>
                      <input
                        type="number"
                        value={formData.displayOrder || 0}
                        onChange={(e) => update('displayOrder', parseInt(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('crisis.script.approvedBy', 'Approved By')}</label>
                      <input
                        type="text"
                        value={formData.approvedBy || ''}
                        onChange={(e) => update('approvedBy', e.target.value)}
                        placeholder="Expert name"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => update('isActive', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-6">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('common.save', 'Save')}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
              >
                {t('common.cancel', 'Cancel')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// PromptsTab component for AI prompts management
function PromptsTab({
  prompts,
  editingKey,
  editContent,
  editActive,
  saveError,
  saving,
  resettingKey,
  setEditContent,
  setEditActive,
  onEdit,
  onSave,
  onCancel,
  onReset,
  getIcon,
  getCategory,
  getLanguage,
  t,
}: {
  prompts: PromptSlot[];
  editingKey: string | null;
  editContent: string;
  editActive: boolean;
  saveError: string | null;
  saving: boolean;
  resettingKey: string | null;
  setEditContent: (v: string) => void;
  setEditActive: (v: boolean) => void;
  onEdit: (slot: PromptSlot) => void;
  onSave: () => void;
  onCancel: () => void;
  onReset: (key: string) => void;
  getIcon: (key: string) => any;
  getCategory: (key: string) => string;
  getLanguage: (key: string) => string;
  t: any;
}) {
  // Filter to only show insight prompts (chat prompts are deprecated)
  const insightPrompts = prompts.filter(p => p.key.includes('insight'));

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-3">
        <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">{t('prompts.info.title', 'AI Prompt Configuration')}</p>
          <p className="mt-1">{t('prompts.info.desc', 'These prompts are used by the Cosmic Insight feature. Chat system prompts are managed internally.')}</p>
        </div>
      </div>

      {/* Prompts list */}
      <div className="space-y-3">
        {insightPrompts.map((slot) => {
          const Icon = getIcon(slot.key);
          const isEditing = editingKey === slot.key;

          return (
            <div
              key={slot.key}
              className={`border rounded-xl overflow-hidden transition-all ${
                isEditing ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    slot.isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-200 text-gray-400'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{slot.key}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-600">
                        {getLanguage(slot.key)}
                      </span>
                      {!slot.isActive && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                          {t('prompts.inactive', 'Inactive')}
                        </span>
                      )}
                      {slot.isCustomized && (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                          {t('prompts.modified', 'Modified')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{getCategory(slot.key)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => onEdit(slot)}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {slot.isCustomized && (
                        <button
                          onClick={() => onReset(slot.key)}
                          disabled={resettingKey === slot.key}
                          className="p-2 text-gray-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition disabled:opacity-50"
                        >
                          {resettingKey === slot.key ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Content */}
              {isEditing ? (
                <div className="p-4 space-y-4">
                  {saveError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {saveError}
                    </div>
                  )}
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-48 p-3 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 resize-y"
                    placeholder={t('prompts.placeholder', 'Enter prompt content...')}
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700">{t('prompts.active', 'Active')}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={onCancel}
                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                      <button
                        onClick={onSave}
                        disabled={saving}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        {t('common.save', 'Save')}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4">
                  <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-32">
                    {slot.currentContent.substring(0, 300)}
                    {slot.currentContent.length > 300 && '...'}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {insightPrompts.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {t('prompts.noPrompts', 'No prompts found')}
        </div>
      )}
    </div>
  );
}

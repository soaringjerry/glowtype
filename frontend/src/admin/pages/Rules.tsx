import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

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
  const api = useAdminApi();

  const loadData = useCallback(async () => {
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
  }, [api]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
        >
          <Plus className="w-4 h-4" />
          {t('rules.add')}
        </button>
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
    </div>
  );
}

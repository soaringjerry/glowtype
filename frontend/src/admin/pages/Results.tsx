import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, RefreshCw, Filter, Clock3, Sparkles } from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface QuizResult {
  id: number;
  resultTypeCode: string;
  language: string;
  channel?: string;
  entryPoint?: string;
  source?: string;
  dimensionScores?: Record<string, number> | string | null;
  createdAt: string;
}

interface Glowtype {
  id: number;
  typeCode: string;
  nameZh?: string;
  nameEn?: string;
}

type TypeFilter = 'all' | string;

export default function Results() {
  const { t, i18n } = useTranslation('admin');
  const api = useAdminApi();

  const [results, setResults] = useState<QuizResult[]>([]);
  const [glowtypes, setGlowtypes] = useState<Glowtype[]>([]);
  const [limit, setLimit] = useState<number>(100);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseScores = (scores: QuizResult['dimensionScores']): Record<string, number> => {
    if (!scores) return {};
    if (typeof scores === 'string') {
      try {
        return JSON.parse(scores);
      } catch (e) {
        console.warn('Failed to parse dimension scores', e);
        return {};
      }
    }
    return scores;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [resData, glowtypeData] = await Promise.all([
      api.listQuizResults({ limit }),
      api.listGlowtypes(),
    ]);

    if (resData) {
      setResults(resData);
    } else if (api.error) {
      setError(api.error);
    }
    if (glowtypeData) setGlowtypes(glowtypeData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  const filteredResults = useMemo(() => {
    if (typeFilter === 'all') return results;
    return results.filter((r) => r.resultTypeCode === typeFilter);
  }, [results, typeFilter]);

  const getTypeLabel = (typeCode: string) => {
    const record = glowtypes.find((g) => g.typeCode === typeCode);
    if (!record) return typeCode;
    return record.nameZh && i18n.language === 'zh-CN'
      ? `${typeCode} · ${record.nameZh}`
      : record.nameEn
      ? `${typeCode} · ${record.nameEn}`
      : typeCode;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const renderScores = (scores: Record<string, number>) => {
    const items = Object.entries(scores)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3);
    if (items.length === 0) return <span className="text-gray-400">{t('results.noScores')}</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {items.map(([dim, score]) => (
          <span
            key={dim}
            className={`px-2 py-1 text-xs rounded ${
              score > 0 ? 'bg-green-100 text-green-700' : score < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {dim}: {score > 0 ? '+' : ''}
            {score}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('results.title')}</h1>
          <p className="text-gray-500">{t('results.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('results.refresh')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2 text-gray-700">
          <Filter className="w-4 h-4" />
          <span className="font-medium text-sm">{t('results.filters')}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">{t('results.typeFilter')}</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            <option value="all">{t('results.allTypes')}</option>
            {glowtypes.map((gt) => (
              <option key={gt.id} value={gt.typeCode}>
                {gt.typeCode}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">{t('results.limit')}</label>
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
          >
            {[20, 50, 100, 200, 500].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock3 className="w-4 h-4" />
          {t('results.latestNote', { count: limit })}
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : error ? (
          <div className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">
            {t('common.error')}: {error}
          </div>
        ) : filteredResults.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {t('results.empty')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="text-xs uppercase text-gray-500 border-b">
                  <th className="py-2">{t('results.type')}</th>
                  <th className="py-2">{t('results.language')}</th>
                  <th className="py-2">{t('results.channel')}</th>
                  <th className="py-2">{t('results.entry')}</th>
                  <th className="py-2">{t('results.source')}</th>
                  <th className="py-2">{t('results.createdAt')}</th>
                  <th className="py-2">{t('results.dimensions')}</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {filteredResults.map((item) => {
                  const scores = parseScores(item.dimensionScores);
                  return (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded font-medium">
                            {item.resultTypeCode || t('results.unmatched')}
                          </span>
                          <span className="text-gray-500">{getTypeLabel(item.resultTypeCode)}</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-gray-700 uppercase">{item.language || '-'}</td>
                      <td className="py-3 pr-4 text-gray-700">{item.channel || t('results.unknown')}</td>
                      <td className="py-3 pr-4 text-gray-700">{item.entryPoint || '-'}</td>
                      <td className="py-3 pr-4 text-gray-700">{item.source || '-'}</td>
                      <td className="py-3 pr-4 text-gray-500">{formatDate(item.createdAt)}</td>
                      <td className="py-3 pr-4">{renderScores(scores)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-start gap-3">
        <Sparkles className="w-5 h-5 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">{t('results.noteTitle')}</p>
          <p className="mt-1">{t('results.noteBody')}</p>
        </div>
      </div>
    </div>
  );
}

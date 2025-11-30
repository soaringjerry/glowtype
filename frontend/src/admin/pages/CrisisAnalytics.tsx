import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  TrendingUp,
  Users,
  Loader2,
  RefreshCw,
  Sparkles,
  Globe,
  Calendar,
  Shield,
  Activity,
  BarChart3,
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface CrisisAnalyticsData {
  summary: {
    totalEvents: number;
    level3Events: number;
    level2Events: number;
    uniqueSessions: number;
    dateRange: string;
    avgMessageIndex: number;
  };
  byLevel: Array<{ level: number; count: number; percent: number }>;
  byCategory: Array<{ category: string; count: number; percent: number }>;
  byGlowtype: Array<{ glowtypeCode: string; count: number; percent: number }>;
  byLanguage: Array<{ language: string; count: number; percent: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
  weeklyTrend: Array<{ week: string; count: number }>;
  detectionVia: Array<{ method: string; count: number; percent: number }>;
  insights: {
    mostCommonCategory: string;
    highRiskRate: number;
    avgMessagesBeforeCrisis: number;
    peakDay: string;
    interpretation: string;
    interpretationZh: string;
  };
}

type PresetRange = '7d' | '30d' | '90d' | 'all';
type TrendView = 'daily' | 'weekly';

export default function CrisisAnalytics() {
  const { i18n } = useTranslation('admin');
  const api = useAdminApi();
  const [data, setData] = useState<CrisisAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetRange>('30d');
  const [trendView, setTrendView] = useState<TrendView>('daily');

  const isZh = i18n.language.startsWith('zh');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getCrisisAnalytics(preset);
      if (result) {
        setData(result);
      } else {
        setError(isZh ? '加载数据失败' : 'Failed to load data');
      }
    } catch {
      setError(isZh ? '加载数据失败' : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  const getLevelColor = (level: number) => {
    switch (level) {
      case 3: return 'bg-red-500';
      case 2: return 'bg-amber-500';
      case 1: return 'bg-yellow-400';
      default: return 'bg-gray-400';
    }
  };

  const getLevelLabel = (level: number) => {
    const labels = isZh
      ? { 3: '高风险', 2: '中风险', 1: '低风险' }
      : { 3: 'High Risk', 2: 'Medium Risk', 1: 'Low Risk' };
    return labels[level as keyof typeof labels] || `Level ${level}`;
  };

  const getCategoryLabel = (cat: string) => {
    const labels = isZh
      ? { hopelessness: '绝望感', 'self-harm': '自伤风险', isolation: '孤立感', unknown: '未分类' }
      : { hopelessness: 'Hopelessness', 'self-harm': 'Self-harm Risk', isolation: 'Isolation', unknown: 'Unknown' };
    return labels[cat as keyof typeof labels] || cat;
  };

  const getGlowtypeLabel = (code: string) => {
    const labels = isZh
      ? { 'radiant-nebula': '璀璨星云', 'quiet-comet': '静谧彗星', 'hidden-aurora': '隐世极光', 'warm-ember': '温暖余烬', unknown: '未知' }
      : { 'radiant-nebula': 'Radiant Nebula', 'quiet-comet': 'Quiet Comet', 'hidden-aurora': 'Hidden Aurora', 'warm-ember': 'Warm Ember', unknown: 'Unknown' };
    return labels[code as keyof typeof labels] || code;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <AlertTriangle className="w-8 h-8 mb-2" />
        <p>{error || (isZh ? '无数据' : 'No data')}</p>
        <button
          onClick={loadData}
          className="mt-4 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition"
        >
          {isZh ? '重试' : 'Retry'}
        </button>
      </div>
    );
  }

  const trendData = trendView === 'daily' ? data.dailyTrend : data.weeklyTrend;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-rose-500" />
            {isZh ? '危机分析' : 'Crisis Analytics'}
          </h1>
          <p className="text-gray-500">{isZh ? '匿名聚合危机事件趋势分析' : 'Anonymous aggregated crisis event trends'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['7d', '30d', '90d', 'all'] as PresetRange[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  preset === p ? 'bg-white shadow text-rose-600 font-medium' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p === '7d' ? (isZh ? '7天' : '7 Days')
                  : p === '30d' ? (isZh ? '30天' : '30 Days')
                  : p === '90d' ? (isZh ? '90天' : '90 Days')
                  : (isZh ? '全部' : 'All')}
              </button>
            ))}
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {isZh ? '刷新' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '总事件数' : 'Total Events'}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.summary.totalEvents.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">{data.summary.dateRange}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '高风险 (L3)' : 'High Risk (L3)'}</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{data.summary.level3Events}</p>
          <p className="text-xs text-gray-400 mt-1">
            {data.insights.highRiskRate.toFixed(1)}% {isZh ? '的总事件' : 'of total'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '中风险 (L2)' : 'Medium Risk (L2)'}</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{data.summary.level2Events}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '涉及会话数' : 'Sessions Involved'}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.summary.uniqueSessions}</p>
          <p className="text-xs text-gray-400 mt-1">
            {isZh ? '平均在第' : 'Avg at msg #'}{data.summary.avgMessageIndex.toFixed(1)}{isZh ? '条消息触发' : ''}
          </p>
        </div>
      </div>

      {/* Risk Level Distribution & Trigger Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Level Distribution */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '风险等级分布' : 'Risk Level Distribution'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '各等级事件占比' : 'Events by risk level'}</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.byLevel.map((item) => (
              <div key={item.level} className="flex items-center gap-3">
                <span className="w-20 text-sm font-medium text-gray-700">{getLevelLabel(item.level)}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getLevelColor(item.level)} transition-all duration-500`}
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <span className="w-16 text-sm text-gray-600 text-right">
                  {item.count} ({item.percent.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trigger Categories */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '触发类别' : 'Trigger Categories'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '危机信号类型分布' : 'Types of crisis signals'}</p>
            </div>
          </div>

          <div className="space-y-3">
            {data.byCategory.map((item) => (
              <div key={item.category} className="flex items-center gap-3">
                <span className="w-24 text-sm font-medium text-gray-700">{getCategoryLabel(item.category)}</span>
                <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-400 transition-all duration-500"
                    style={{ width: `${item.percent}%` }}
                  />
                </div>
                <span className="w-16 text-sm text-gray-600 text-right">
                  {item.count} ({item.percent.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Glowtype & Language Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Glowtype */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '按光格分布' : 'By Glowtype'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '不同光格的危机事件' : 'Crisis events by personality type'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {data.byGlowtype.map((item) => (
              <div key={item.glowtypeCode} className="p-3 bg-gray-50 rounded-xl">
                <p className="text-sm font-medium text-gray-800 truncate">{getGlowtypeLabel(item.glowtypeCode)}</p>
                <p className="text-lg font-bold text-indigo-600 mt-1">{item.count}</p>
                <p className="text-xs text-gray-400">{item.percent.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* By Language */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '按语言分布' : 'By Language'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '不同语言用户的事件' : 'Events by user language'}</p>
            </div>
          </div>

          <div className="flex gap-3">
            {data.byLanguage.map((item) => (
              <div key={item.language} className="flex-1 text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-2xl font-bold text-green-600">{item.percent.toFixed(0)}%</p>
                <p className="text-sm text-gray-600 mt-1">
                  {item.language === 'zh-CN' || item.language === 'zh' ? '中文' : item.language === 'en' ? 'English' : item.language}
                </p>
                <p className="text-xs text-gray-400">{item.count} {isZh ? '次' : 'events'}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Time Trends */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '时间趋势' : 'Time Trends'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '危机事件随时间变化' : 'Crisis events over time'}</p>
            </div>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['daily', 'weekly'] as TrendView[]).map((v) => (
              <button
                key={v}
                onClick={() => setTrendView(v)}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  trendView === v ? 'bg-white shadow text-rose-600 font-medium' : 'text-gray-600'
                }`}
              >
                {v === 'daily' ? (isZh ? '按日' : 'Daily') : (isZh ? '按周' : 'Weekly')}
              </button>
            ))}
          </div>
        </div>

        {trendData.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{isZh ? '暂无趋势数据' : 'No trend data'}</div>
        ) : (
          <div className="flex items-end gap-1 h-32">
            {trendData.map((point, i) => {
              const maxCount = Math.max(...trendData.map((p) => p.count), 1);
              const height = (point.count / maxCount) * 100;
              const dateStr = 'date' in point ? point.date : point.week;
              return (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  <div className="w-full bg-gray-100 rounded-lg overflow-hidden relative" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-rose-500 to-pink-400 transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-xs font-bold text-gray-700 bg-white/80 px-1 rounded">{point.count}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">
                    {dateStr.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {data.insights.peakDay && (
          <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {isZh ? '峰值日：' : 'Peak day: '}{data.insights.peakDay}
          </p>
        )}
      </div>

      {/* Insights */}
      <div className="bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-200 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-semibold text-gray-800">{isZh ? '分析洞察' : 'Insights'}</h3>
        </div>
        <p className="text-gray-700 leading-relaxed">
          {isZh ? data.insights.interpretationZh : data.insights.interpretation}
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>{isZh ? '隐私说明：' : 'Privacy Note:'}</strong>{' '}
        {isZh
          ? '所有数据均为匿名聚合统计，不包含任何可识别个人身份的信息或聊天内容。'
          : 'All data is anonymized aggregate statistics with no personally identifiable information or chat content.'}
      </div>
    </div>
  );
}

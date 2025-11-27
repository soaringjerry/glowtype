import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Users,
  Share2,
  MessageSquare,
  Sparkles,
  Loader2,
  RefreshCw,
  Activity,
  Clock3
} from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface StatsOverview {
  today: { quizCompleted: number; shareGenerated: number; aiChatsStarted: number; aiInsightUsed: number };
  week: { quizCompleted: number; shareGenerated: number; aiChatsStarted: number; aiInsightUsed: number };
  total: { quizCompleted: number; shareGenerated: number; aiChatsStarted: number; aiInsightUsed: number };
}

interface GlowtypeDistribution {
  typeCode: string;
  count: number;
}

type TrendKey = keyof Pick<DailyStat, 'quizCompleted' | 'shareGenerated' | 'aiChatsStarted' | 'aiInsightUsed'>;

interface DailyStat {
  date: string;
  quizCompleted: number;
  shareGenerated: number;
  aiChatsStarted: number;
  aiInsightUsed: number;
}

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

export default function Dashboard() {
  const { t } = useTranslation('admin');
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [distribution, setDistribution] = useState<GlowtypeDistribution[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [recentResults, setRecentResults] = useState<QuizResult[]>([]);
  const [loading, setLoading] = useState(true);
  const api = useAdminApi();

  const loadData = async () => {
    setLoading(true);
    const [statsData, distData, dailyData, resultsData] = await Promise.all([
      api.getStatsOverview(),
      api.getGlowtypeDistribution(),
      api.getDailyStats(14),
      api.listQuizResults({ limit: 8 }),
    ]);
    if (statsData) setStats(statsData);
    if (distData) setDistribution(distData);
    if (dailyData) setDailyStats(dailyData);
    if (resultsData) setRecentResults(resultsData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const getTopScores = (scores: Record<string, number>) =>
    Object.entries(scores)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
      .slice(0, 3);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const StatCard = ({
    title,
    today,
    week,
    total,
    icon: Icon,
    color,
  }: {
    title: string;
    today: number;
    week: number;
    total: number;
    icon: any;
    color: string;
  }) => (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-2xl font-bold text-gray-900">{today}</p>
          <p className="text-xs text-gray-500">{t('dashboard.today')}</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-700">{week}</p>
          <p className="text-xs text-gray-500">{t('dashboard.thisWeek')}</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-500">{total}</p>
          <p className="text-xs text-gray-500">{t('dashboard.total')}</p>
        </div>
      </div>
    </div>
  );

  const trendMetrics: { key: TrendKey; label: string; gradient: string }[] = [
    { key: 'quizCompleted', label: t('dashboard.quizCompleted'), gradient: 'from-purple-500 to-purple-300' },
    { key: 'shareGenerated', label: t('dashboard.sharesGenerated'), gradient: 'from-pink-500 to-orange-300' },
    { key: 'aiChatsStarted', label: t('dashboard.aiChatsStarted'), gradient: 'from-blue-500 to-cyan-300' },
    { key: 'aiInsightUsed', label: t('dashboard.aiInsightsUsed'), gradient: 'from-amber-500 to-yellow-300' },
  ];

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
          <h1 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h1>
          <p className="text-gray-500">{t('dashboard.subtitle')}</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('dashboard.refresh')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.quizCompleted')}
          today={stats?.today.quizCompleted || 0}
          week={stats?.week.quizCompleted || 0}
          total={stats?.total.quizCompleted || 0}
          icon={Users}
          color="bg-purple-500"
        />
        <StatCard
          title={t('dashboard.sharesGenerated')}
          today={stats?.today.shareGenerated || 0}
          week={stats?.week.shareGenerated || 0}
          total={stats?.total.shareGenerated || 0}
          icon={Share2}
          color="bg-pink-500"
        />
        <StatCard
          title={t('dashboard.aiChatsStarted')}
          today={stats?.today.aiChatsStarted || 0}
          week={stats?.week.aiChatsStarted || 0}
          total={stats?.total.aiChatsStarted || 0}
          icon={MessageSquare}
          color="bg-blue-500"
        />
        <StatCard
          title={t('dashboard.aiInsightsUsed')}
          today={stats?.today.aiInsightUsed || 0}
          week={stats?.week.aiInsightUsed || 0}
          total={stats?.total.aiInsightUsed || 0}
          icon={Sparkles}
          color="bg-amber-500"
        />
      </div>

      {/* Daily Trend */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{t('dashboard.dailyTrend')}</h3>
            <p className="text-sm text-gray-500">{t('dashboard.dailyTrendSubtitle')}</p>
          </div>
        </div>

        {dailyStats.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            {t('dashboard.noDailyData')}
          </div>
        ) : (
          <div className="space-y-6">
            {trendMetrics.map((metric) => {
              const maxVal = Math.max(...dailyStats.map((d) => d[metric.key] || 0), 1);
              return (
                <div key={metric.key}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{metric.label}</span>
                    <span className="text-xs text-gray-400">
                      {t('dashboard.lastNDays', { days: dailyStats.length })}
                    </span>
                  </div>
                  <div className="flex items-end gap-1">
                    {dailyStats.map((day) => {
                      const height = maxVal ? (day[metric.key] / maxVal) * 100 : 0;
                      return (
                        <div key={`${metric.key}-${day.date}`} className="flex-1 min-w-[10px]">
                          <div className="relative h-24 bg-gray-100 rounded-lg overflow-hidden">
                            <div
                              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${metric.gradient}`}
                              style={{ height: `${height}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-center text-gray-400 mt-1">
                            {day.date.slice(5)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Results */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
            <Clock3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{t('dashboard.recentResults')}</h3>
            <p className="text-sm text-gray-500">{t('dashboard.recentResultsSubtitle')}</p>
          </div>
        </div>

        {recentResults.length === 0 ? (
          <div className="text-center py-10 text-gray-400">{t('dashboard.noRecentResults')}</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentResults.map((res) => {
              const scores = parseScores(res.dimensionScores);
              const topScores = getTopScores(scores);
              return (
                <div key={res.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-1 text-xs bg-purple-50 text-purple-700 rounded font-semibold">
                        {res.resultTypeCode || t('dashboard.unmapped')}
                      </span>
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                        {res.language?.toUpperCase() || '-'}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(res.createdAt)}</span>
                    </div>
                    {topScores.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {topScores.map(([dim, score]) => (
                          <span
                            key={dim}
                            className={`px-2 py-1 text-xs rounded ${
                              score > 0
                                ? 'bg-green-100 text-green-700'
                                : score < 0
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {dim}: {score > 0 ? '+' : ''}
                            {score}
                          </span>
                        ))}
                      </div>
                    )}
                    {topScores.length === 0 && (
                      <p className="text-xs text-gray-400 mt-1">{t('dashboard.noScores')}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 space-y-1 text-left md:text-right">
                    <p>{t('dashboard.channelLabel', { channel: res.channel || t('dashboard.unknown') })}</p>
                    <p>{t('dashboard.entryLabel', { entry: res.entryPoint || '-' })}</p>
                    <p>{t('dashboard.sourceLabel', { source: res.source || '-' })}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Glowtype Distribution */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{t('dashboard.distribution')}</h3>
            <p className="text-sm text-gray-500">{t('dashboard.distributionSubtitle')}</p>
          </div>
        </div>

        {distribution.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {t('dashboard.noData')}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {distribution.map((item) => {
              const maxCount = Math.max(...distribution.map((d) => d.count));
              const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              return (
                <div key={item.typeCode} className="text-center">
                  <div className="relative h-24 bg-gray-100 rounded-lg overflow-hidden mb-2">
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-purple-500 to-pink-400 transition-all"
                      style={{ height: `${percentage}%` }}
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                      {item.count}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-gray-600">{item.typeCode}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>{t('dashboard.privacyNote')}</strong> {t('dashboard.privacyText')}
      </div>
    </div>
  );
}

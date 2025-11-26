import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  Users,
  Share2,
  MessageSquare,
  Sparkles,
  Loader2,
  RefreshCw
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

export default function Dashboard() {
  const { t } = useTranslation('admin');
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [distribution, setDistribution] = useState<GlowtypeDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const api = useAdminApi();

  const loadData = async () => {
    setLoading(true);
    const [statsData, distData] = await Promise.all([
      api.getStatsOverview(),
      api.getGlowtypeDistribution(),
    ]);
    if (statsData) setStats(statsData);
    if (distData) setDistribution(distData);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

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

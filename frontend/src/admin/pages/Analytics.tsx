import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarChart3,
  TrendingUp,
  Users,
  Calculator,
  Loader2,
  RefreshCw,
  Calendar,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Globe,
  Smartphone,
  Languages,
  Filter,
  Brain,
} from 'lucide-react';
import { useAdminApi, type AnalyticsResponse, type AnalyticsRequest } from '../hooks/useAdmin';
import { getApiBaseUrl } from '../../api/baseUrl';

type PresetRange = '30d' | '90d' | 'all' | 'custom';
type TrendView = 'daily' | 'weekly' | 'monthly';

export default function Analytics() {
  const { i18n } = useTranslation('admin');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState<PresetRange>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [trendView, setTrendView] = useState<TrendView>('daily');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const api = useAdminApi();

  const loadData = async () => {
    setLoading(true);
    const params: AnalyticsRequest = {};
    if (preset === 'custom' && customStart && customEnd) {
      params.startDate = customStart;
      params.endDate = customEnd;
    } else if (preset !== 'custom') {
      params.preset = preset;
    }
    const result = await api.getAnalytics(params);
    if (result) setData(result);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd]);

  const isZh = i18n.language.startsWith('zh');

  const generateAIAnalysis = async (type: 'report' | 'suggestions') => {
    if (!data) return;
    setAiLoading(true);
    setAiError(null);

    const systemPrompts = {
      report: isZh
        ? `你是一位数据分析专家，请分析以下心理测试数据，给出专业的统计解读。包括：
1. 样本概况总结
2. 各维度得分分布特点
3. 信度分析结果解读（Cronbach's Alpha、分半信度）
4. 时间趋势分析
5. 用户群体特征（地区、设备、语言分布）
6. 关键发现和建议
请用清晰的结构化格式输出。`
        : `You are a data analyst expert. Analyze the following psychological test data and provide professional statistical interpretation. Include:
1. Sample overview summary
2. Dimension score distribution characteristics
3. Reliability analysis interpretation (Cronbach's Alpha, split-half reliability)
4. Time trend analysis
5. User demographics (region, device, language distribution)
6. Key findings and recommendations
Please output in clear structured format.`,
      suggestions: isZh
        ? `你是一位心理测量学专家，请根据以下测试数据给出题目改进建议。包括：
1. 基于信度分析（Alpha=${data.reliability.cronbachAlpha.toFixed(3)}）的整体评估
2. 根据题目-总分相关系数识别需要修改的题目（低于0.3的题目需重点关注）
3. 根据维度得分分布分析题目难度是否合适
4. 具体的题目改进建议
5. 提高测试信度的方法建议
请给出可操作的具体建议。`
        : `You are a psychometrics expert. Based on the following test data, provide suggestions for question improvement. Include:
1. Overall assessment based on reliability analysis (Alpha=${data.reliability.cronbachAlpha.toFixed(3)})
2. Identify questions needing modification based on item-total correlations (focus on items below 0.3)
3. Analyze if question difficulty is appropriate based on dimension score distributions
4. Specific question improvement suggestions
5. Methods to improve test reliability
Please provide actionable specific recommendations.`,
    };

    const dataForAI = {
      summary: data.summary,
      reliability: data.reliability,
      dimensionStats: Object.fromEntries(
        Object.entries(data.dimensionStats).map(([k, v]) => [k, { mean: v.mean, stdDev: v.stdDev, min: v.min, max: v.max }])
      ),
      segments: {
        topRegions: data.segments.byRegion.slice(0, 5),
        devices: data.segments.byDevice,
        languages: data.segments.byLanguage,
      },
      trends: {
        recentDays: data.trends.daily.slice(-7),
      },
    };

    try {
      const res = await fetch(`${getApiBaseUrl()}/chat/insight`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: systemPrompts[type],
          prompt: JSON.stringify(dataForAI, null, 2),
          language: i18n.language,
        }),
      });
      const result = await res.json();
      if (result.reply) {
        setAiAnalysis(result.reply);
      } else {
        setAiError(result.error || 'Failed to generate analysis');
      }
    } catch (e) {
      setAiError('Network error');
    } finally {
      setAiLoading(false);
    }
  };

  const reliabilityLevel = useMemo(() => {
    if (!data) return { level: 'unknown', color: 'gray' };
    const alpha = data.reliability.cronbachAlpha;
    if (alpha >= 0.9) return { level: isZh ? '优秀' : 'Excellent', color: 'green' };
    if (alpha >= 0.8) return { level: isZh ? '良好' : 'Good', color: 'blue' };
    if (alpha >= 0.7) return { level: isZh ? '可接受' : 'Acceptable', color: 'yellow' };
    if (alpha >= 0.6) return { level: isZh ? '存疑' : 'Questionable', color: 'orange' };
    return { level: isZh ? '较差' : 'Poor', color: 'red' };
  }, [data, isZh]);

  const trendData = useMemo(() => {
    if (!data) return [];
    switch (trendView) {
      case 'daily':
        return data.trends.daily;
      case 'weekly':
        return data.trends.weekly;
      case 'monthly':
        return data.trends.monthly;
    }
  }, [data, trendView]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        {isZh ? '加载数据失败' : 'Failed to load data'}
      </div>
    );
  }

  const dimEntries = Object.entries(data.dimensionStats);
  const correlationEntries = Object.entries(data.correlationMatrix);
  const itemCorrelations = Object.entries(data.reliability.itemTotalCorrelations).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isZh ? '数据分析' : 'Data Analytics'}</h1>
          <p className="text-gray-500">{isZh ? '学术研究与趋势分析' : 'Academic Research & Trend Analysis'}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Preset buttons */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['30d', '90d', 'all'] as PresetRange[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 text-sm rounded-md transition ${
                  preset === p ? 'bg-white shadow text-purple-600 font-medium' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {p === '30d' ? (isZh ? '30天' : '30 Days') : p === '90d' ? (isZh ? '90天' : '90 Days') : isZh ? '全部' : 'All'}
              </button>
            ))}
            <button
              onClick={() => setPreset('custom')}
              className={`px-3 py-1.5 text-sm rounded-md transition flex items-center gap-1 ${
                preset === 'custom' ? 'bg-white shadow text-purple-600 font-medium' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-3 h-3" />
              {isZh ? '自定义' : 'Custom'}
            </button>
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-2 py-1.5 text-sm border rounded-lg"
              />
              <span className="text-gray-400">-</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-2 py-1.5 text-sm border rounded-lg"
              />
            </div>
          )}
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
            <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '总样本数' : 'Total Samples'}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.summary.totalResponses.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            {data.summary.dateRange.start} ~ {data.summary.dateRange.end}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '题目数量' : 'Questions'}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.summary.questionCount}</p>
          <p className="text-xs text-gray-400 mt-1">{isZh ? '活跃题目' : 'Active questions'}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl bg-${reliabilityLevel.color}-500 flex items-center justify-center`}>
              {reliabilityLevel.color === 'green' || reliabilityLevel.color === 'blue' ? (
                <CheckCircle className="w-5 h-5 text-white" />
              ) : (
                <AlertCircle className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="text-sm text-gray-500">Cronbach's Alpha</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.reliability.cronbachAlpha.toFixed(3)}</p>
          <p className={`text-xs mt-1 text-${reliabilityLevel.color}-600 font-medium`}>{reliabilityLevel.level}</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm text-gray-500">{isZh ? '分半信度' : 'Split-Half'}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{data.reliability.spearmanBrown.toFixed(3)}</p>
          <p className="text-xs text-gray-400 mt-1">Spearman-Brown</p>
        </div>
      </div>

      {/* Dimension Stats & Reliability */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dimension Statistics */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '维度统计' : 'Dimension Statistics'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '各维度得分分布' : 'Score distribution by dimension'}</p>
            </div>
          </div>

          {dimEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">{isZh ? '暂无数据' : 'No data'}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-medium text-gray-600">{isZh ? '维度' : 'Dimension'}</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">{isZh ? '均值' : 'Mean'}</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">{isZh ? '标准差' : 'StdDev'}</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">{isZh ? '中位数' : 'Median'}</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-600">{isZh ? '范围' : 'Range'}</th>
                  </tr>
                </thead>
                <tbody>
                  {dimEntries.map(([dim, stat]) => (
                    <tr key={dim} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 px-2 font-medium text-gray-800">{dim}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{stat.mean.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{stat.stdDev.toFixed(2)}</td>
                      <td className="py-2 px-2 text-right text-gray-600">{stat.median.toFixed(1)}</td>
                      <td className="py-2 px-2 text-right text-gray-500 text-xs">[{stat.min}, {stat.max}]</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Distribution Histogram for first dimension */}
          {dimEntries.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-gray-500 mb-2">
                {isZh ? `${dimEntries[0][0]} 分布直方图` : `${dimEntries[0][0]} Distribution`}
              </p>
              <div className="flex items-end gap-1 h-20">
                {dimEntries[0][1].distribution.map((d, i) => {
                  const maxCount = Math.max(...dimEntries[0][1].distribution.map((x) => x.count), 1);
                  const height = (d.count / maxCount) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <div className="w-full bg-gray-100 rounded-sm overflow-hidden" style={{ height: '60px' }}>
                        <div
                          className="w-full bg-gradient-to-t from-purple-500 to-pink-400"
                          style={{ height: `${height}%`, marginTop: `${100 - height}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-gray-400 mt-1 truncate w-full text-center">{d.bin}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Reliability Analysis */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '信度分析' : 'Reliability Analysis'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '测试内部一致性' : 'Test internal consistency'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-600 mb-1">Cronbach's Alpha</p>
              <p className="text-2xl font-bold text-blue-700">{data.reliability.cronbachAlpha.toFixed(3)}</p>
            </div>
            <div className="p-4 bg-cyan-50 rounded-xl">
              <p className="text-xs text-cyan-600 mb-1">Spearman-Brown</p>
              <p className="text-2xl font-bold text-cyan-700">{data.reliability.spearmanBrown.toFixed(3)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {isZh ? '题目-总分相关系数' : 'Item-Total Correlations'}
            </p>
            {itemCorrelations.length === 0 ? (
              <p className="text-sm text-gray-400">{isZh ? '需要更多数据' : 'Need more data'}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {itemCorrelations.map(([qId, corr]) => {
                  const isLow = corr < 0.3;
                  return (
                    <div key={qId} className="flex items-center gap-2">
                      <span className="w-16 text-xs font-mono text-gray-600 truncate">{qId}</span>
                      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                        <div
                          className={`h-full transition-all ${isLow ? 'bg-red-400' : 'bg-blue-400'}`}
                          style={{ width: `${Math.max(0, corr) * 100}%` }}
                        />
                      </div>
                      <span className={`w-12 text-xs text-right ${isLow ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                        {corr.toFixed(3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {isZh ? '* 低于 0.3 的题目可能需要修改' : '* Items below 0.3 may need revision'}
            </p>
          </div>
        </div>
      </div>

      {/* Time Trends */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '时间趋势' : 'Time Trends'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '完成数量变化' : 'Completion volume changes'}</p>
            </div>
          </div>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as TrendView[]).map((v) => (
              <button
                key={v}
                onClick={() => setTrendView(v)}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  trendView === v ? 'bg-white shadow text-green-600 font-medium' : 'text-gray-600'
                }`}
              >
                {v === 'daily' ? (isZh ? '按日' : 'Daily') : v === 'weekly' ? (isZh ? '按周' : 'Weekly') : isZh ? '按月' : 'Monthly'}
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
              return (
                <div key={i} className="flex-1 flex flex-col items-center group">
                  <div className="w-full bg-gray-100 rounded-lg overflow-hidden relative" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-green-500 to-emerald-400 transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                      <span className="text-xs font-bold text-gray-700 bg-white/80 px-1 rounded">{point.count}</span>
                    </div>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 truncate w-full text-center">
                    {point.date.slice(5)}
                  </span>
                  {point.change !== 0 && (
                    <span className={`text-[8px] ${point.change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {point.change > 0 ? '+' : ''}{point.change.toFixed(0)}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Segments & Correlation Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segments */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '群组分析' : 'Segment Analysis'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '按地区/设备/语言分组' : 'By region/device/language'}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Region */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{isZh ? '地区分布' : 'By Region'}</span>
              </div>
              <div className="space-y-1">
                {data.segments.byRegion.slice(0, 5).map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="w-12 text-xs text-gray-600">{item.name || 'N/A'}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                      <div className="h-full bg-orange-400" style={{ width: `${item.percent}%` }} />
                    </div>
                    <span className="w-16 text-xs text-gray-500 text-right">{item.percent.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Device */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{isZh ? '设备分布' : 'By Device'}</span>
              </div>
              <div className="flex gap-3">
                {data.segments.byDevice.map((item) => (
                  <div key={item.name} className="flex-1 text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-800">{item.percent.toFixed(0)}%</p>
                    <p className="text-xs text-gray-500 capitalize">{item.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Languages className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{isZh ? '语言分布' : 'By Language'}</span>
              </div>
              <div className="flex gap-3">
                {data.segments.byLanguage.map((item) => (
                  <div key={item.name} className="flex-1 text-center p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-800">{item.percent.toFixed(0)}%</p>
                    <p className="text-xs text-gray-500">{item.name === 'zh-CN' ? '中文' : item.name === 'en' ? 'English' : item.name}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Correlation Matrix */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? '维度相关性' : 'Dimension Correlations'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '各维度之间的相关系数' : 'Correlations between dimensions'}</p>
            </div>
          </div>

          {correlationEntries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">{isZh ? '需要更多数据' : 'Need more data'}</div>
          ) : (
            <div className="space-y-2">
              {correlationEntries.map(([key, corr]) => {
                const [dim1, dim2] = key.split('_');
                const absCorr = Math.abs(corr);
                const color = corr > 0 ? 'bg-blue-400' : 'bg-red-400';
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="w-24 text-xs text-gray-600 truncate">{dim1} × {dim2}</span>
                    <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden flex items-center justify-center relative">
                      <div
                        className={`absolute h-full ${color}`}
                        style={{
                          width: `${absCorr * 50}%`,
                          left: corr >= 0 ? '50%' : undefined,
                          right: corr < 0 ? '50%' : undefined,
                        }}
                      />
                      <span className="relative z-10 text-[10px] font-medium text-gray-700">{corr.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-gray-400 mt-3">
            {isZh ? '正相关（蓝色）/ 负相关（红色）' : 'Positive (blue) / Negative (red) correlation'}
          </p>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800">{isZh ? 'AI 分析助手' : 'AI Analysis Assistant'}</h3>
              <p className="text-sm text-gray-500">{isZh ? '智能数据解读与建议' : 'Smart data interpretation & suggestions'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => generateAIAnalysis('report')}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isZh ? '生成分析报告' : 'Generate Report'}
            </button>
            <button
              onClick={() => generateAIAnalysis('suggestions')}
              disabled={aiLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition disabled:opacity-50"
            >
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {isZh ? '题目改进建议' : 'Improvement Tips'}
            </button>
          </div>
        </div>

        {aiError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
            {aiError}
          </div>
        )}

        {aiAnalysis && (
          <div className="p-4 bg-gray-50 rounded-xl">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{aiAnalysis}</pre>
          </div>
        )}

        {!aiAnalysis && !aiLoading && (
          <div className="text-center py-8 text-gray-400">
            {isZh ? '点击上方按钮生成 AI 分析' : 'Click buttons above to generate AI analysis'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>{isZh ? '隐私说明：' : 'Privacy Note:'}</strong>{' '}
        {isZh
          ? '所有数据均为匿名聚合统计，不包含任何可识别个人身份的信息。'
          : 'All data is anonymized aggregate statistics with no personally identifiable information.'}
      </div>
    </div>
  );
}

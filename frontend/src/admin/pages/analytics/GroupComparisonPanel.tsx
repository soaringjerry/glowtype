import { GitCompare, Smartphone, Languages, HelpCircle, AlertCircle, Bug } from 'lucide-react';
import { useState } from 'react';
import type { GroupComparisonData } from '../../hooks/useAdmin';

interface GroupComparisonPanelProps {
  groupComparison: GroupComparisonData;
  isZh: boolean;
  onAskAI: (question: string, view: string) => void;
}

function EffectSizeBadge({ interpretation, isZh }: { interpretation: string; isZh: boolean }) {
  const colorClass =
    interpretation === 'large' ? 'bg-purple-100 text-purple-700' :
    interpretation === 'medium' ? 'bg-blue-100 text-blue-700' :
    interpretation === 'small' ? 'bg-yellow-100 text-yellow-700' :
    'bg-gray-100 text-gray-500';

  const label = isZh
    ? (interpretation === 'large' ? '大效应' :
       interpretation === 'medium' ? '中效应' :
       interpretation === 'small' ? '小效应' : '微小效应')
    : interpretation;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}>
      {label}
    </span>
  );
}

function SignificanceBadge({ significant, isZh }: { significant: boolean; isZh: boolean }) {
  if (significant) {
    return (
      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
        {isZh ? '显著' : 'Significant'}
      </span>
    );
  }
  return (
    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
      {isZh ? '不显著' : 'Not Significant'}
    </span>
  );
}

function formatLanguageName(name: string): string {
  if (name === 'zh') return '中文';
  if (name === 'en') return 'English';
  return name;
}

export default function GroupComparisonPanel({ groupComparison, isZh, onAskAI }: GroupComparisonPanelProps) {
  const [showDebug, setShowDebug] = useState(false);
  const hasDeviceData = Object.keys(groupComparison.byDevice ?? {}).length > 0;
  const hasLanguageData = Object.keys(groupComparison.byLanguage ?? {}).length > 0;
  const debug = groupComparison.debug;

  return (
    <div id="groupComparison" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
            <GitCompare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{isZh ? '群组对比分析' : 'Group Comparison'}</h3>
            <p className="text-sm text-gray-500">{isZh ? 't检验、ANOVA 和效应量' : 't-test, ANOVA & Effect Size'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {debug && (
            <button
              onClick={() => setShowDebug(!showDebug)}
              className={`p-2 rounded-lg transition-colors ${showDebug ? 'bg-blue-50 text-blue-500' : 'hover:bg-gray-50 text-gray-400'}`}
              title={isZh ? '显示调试信息' : 'Show debug info'}
            >
              <Bug className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => onAskAI(
              isZh ? '请解释群组对比分析结果，t检验和Cohen\'s d代表什么？' : 'Please explain the group comparison results. What do t-test and Cohen\'s d mean?',
              'groupComparison'
            )}
            className="p-2 hover:bg-rose-50 rounded-lg transition-colors group"
            title={isZh ? '询问AI关于群组对比' : 'Ask AI about group comparison'}
          >
            <HelpCircle className="w-5 h-5 text-gray-400 group-hover:text-rose-500" />
          </button>
        </div>
      </div>

      {!hasDeviceData && !hasLanguageData ? (
        <div className="text-center py-8">
          <GitCompare className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">
            {isZh
              ? `群组对比需要每组至少 ${groupComparison.minSample} 个样本`
              : `Group comparison requires at least ${groupComparison.minSample} samples per group`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* By Device */}
          {hasDeviceData && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Smartphone className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-700">
                  {isZh ? '按设备类型' : 'By Device Type'}
                </h4>
              </div>
              <div className="space-y-3">
                {Object.entries(groupComparison.byDevice).map(([dim, comp]) => (
                  <div key={dim} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">{dim}</span>
                      <div className="flex items-center gap-2">
                        <SignificanceBadge significant={comp.significant} isZh={isZh} />
                        <EffectSizeBadge interpretation={comp.effectSize.interpretation} isZh={isZh} />
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      {comp.groups.map((g) => (
                        <div key={g.name} className="flex-1">
                          <span className="font-medium capitalize">{g.name}</span>
                          <span className="text-gray-400 ml-1">(n={g.count})</span>
                          <div className="mt-1">
                            M={g.mean.toFixed(2)}, SD={g.stdDev.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {comp.tTest && (
                      <div className="mt-2 text-xs text-gray-500">
                        t={comp.tTest.statistic.toFixed(2)}, p={comp.tTest.pValue.toFixed(3)}, d={comp.effectSize.value.toFixed(2)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Language */}
          {hasLanguageData && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Languages className="w-4 h-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-700">
                  {isZh ? '按语言' : 'By Language'}
                </h4>
              </div>
              <div className="space-y-3">
                {Object.entries(groupComparison.byLanguage).map(([dim, comp]) => (
                  <div key={dim} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-800">{dim}</span>
                      <div className="flex items-center gap-2">
                        <SignificanceBadge significant={comp.significant} isZh={isZh} />
                        <EffectSizeBadge interpretation={comp.effectSize.interpretation} isZh={isZh} />
                      </div>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-600">
                      {comp.groups.map((g) => (
                        <div key={g.name} className="flex-1">
                          <span className="font-medium">{formatLanguageName(g.name)}</span>
                          <span className="text-gray-400 ml-1">(n={g.count})</span>
                          <div className="mt-1">
                            M={g.mean.toFixed(2)}, SD={g.stdDev.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                    {comp.tTest && (
                      <div className="mt-2 text-xs text-gray-500">
                        t={comp.tTest.statistic.toFixed(2)}, p={comp.tTest.pValue.toFixed(3)}, d={comp.effectSize.value.toFixed(2)}
                      </div>
                    )}
                    {comp.anova && (
                      <div className="mt-2 text-xs text-gray-500">
                        F({comp.anova.dfBetween},{comp.anova.dfWithin})={comp.anova.fStatistic.toFixed(2)}, p={comp.anova.pValue.toFixed(3)}, η²={comp.effectSize.value.toFixed(3)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Excluded Dimensions */}
          {groupComparison.excludedDimensions && groupComparison.excludedDimensions.length > 0 && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-medium text-amber-800">
                  {isZh ? '被排除的维度' : 'Excluded Dimensions'}
                </h4>
              </div>
              <p className="text-xs text-amber-700 mb-2">
                {isZh
                  ? `以下维度因没有至少2个语言组达到 ${groupComparison.minSample} 样本阈值而被排除：`
                  : `The following dimensions were excluded because fewer than 2 language groups met the ${groupComparison.minSample} sample threshold:`}
              </p>
              <div className="space-y-2">
                {groupComparison.excludedDimensions.map((exc) => (
                  <div key={exc.dimension} className="text-xs text-amber-800">
                    <span className="font-medium">{exc.dimension}</span>
                    <span className="text-amber-600 ml-2">
                      ({Object.entries(exc.groupCounts)
                        .map(([lang, count]) => `${formatLanguageName(lang)}: ${count}`)
                        .join(', ')})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">
            {isZh
              ? '* p < 0.05 为显著；Cohen\'s d: 0.2小, 0.5中, 0.8大'
              : '* p < 0.05 is significant; Cohen\'s d: 0.2=small, 0.5=medium, 0.8=large'}
          </p>
        </div>
      )}

      {/* Debug Info Panel */}
      {showDebug && debug && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <h4 className="text-sm font-medium text-blue-800 mb-3">
            {isZh ? '调试信息' : 'Debug Info'}
          </h4>

          <div className="space-y-3 text-xs">
            {/* Basic stats */}
            <div className="flex gap-4">
              <div>
                <span className="text-blue-600">{isZh ? '总记录数' : 'Total Results'}:</span>
                <span className="ml-1 font-mono text-blue-800">{debug.totalResults}</span>
              </div>
              <div>
                <span className="text-blue-600">{isZh ? 'JSON解析错误' : 'Parse Errors'}:</span>
                <span className={`ml-1 font-mono ${debug.parseErrors > 0 ? 'text-red-600 font-bold' : 'text-blue-800'}`}>
                  {debug.parseErrors}
                </span>
              </div>
            </div>

            {/* Language counts */}
            <div>
              <span className="text-blue-600">{isZh ? '按语言统计' : 'By Language'}:</span>
              <div className="mt-1 font-mono text-blue-800">
                {Object.entries(debug.languageCounts ?? {}).map(([lang, count]) => (
                  <span key={lang} className="mr-3">
                    {formatLanguageName(lang)}: {count}
                  </span>
                ))}
              </div>
            </div>

            {/* Dimensions by language */}
            <div>
              <span className="text-blue-600">{isZh ? '每个语言组的维度样本数' : 'Dimension samples per language'}:</span>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="py-1 pr-4 text-blue-700">{isZh ? '维度' : 'Dimension'}</th>
                      {Object.keys(debug.languageCounts ?? {}).map(lang => (
                        <th key={lang} className="py-1 px-2 text-blue-700">{formatLanguageName(lang)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Get all dimensions */}
                    {(() => {
                      const allDims = new Set<string>();
                      Object.values(debug.dimensionsByLang ?? {}).forEach(dimMap => {
                        Object.keys(dimMap).forEach(dim => allDims.add(dim));
                      });
                      return Array.from(allDims).sort().map(dim => (
                        <tr key={dim} className="border-b border-blue-100">
                          <td className="py-1 pr-4 font-medium text-blue-800">{dim}</td>
                          {Object.keys(debug.languageCounts ?? {}).map(lang => {
                            const count = debug.dimensionsByLang?.[lang]?.[dim] ?? 0;
                            const isLow = count < groupComparison.minSample;
                            return (
                              <td key={lang} className={`py-1 px-2 font-mono ${isLow ? 'text-red-600 font-bold' : 'text-blue-800'}`}>
                                {count}
                              </td>
                            );
                          })}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-blue-600">
                {isZh
                  ? `* 红色数字表示低于最小阈值 (${groupComparison.minSample})`
                  : `* Red numbers are below minimum threshold (${groupComparison.minSample})`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

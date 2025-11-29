import { Shield, CheckCircle, AlertCircle, HelpCircle } from 'lucide-react';
import type { ValidityStats } from '../../hooks/useAdmin';

interface ValidityPanelProps {
  validity: ValidityStats;
  isZh: boolean;
  onAskAI: (question: string, view: string) => void;
}

export default function ValidityPanel({ validity, isZh, onAskAI }: ValidityPanelProps) {
  return (
    <div id="validity" className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-800">{isZh ? '效度分析' : 'Validity Analysis'}</h3>
            <p className="text-sm text-gray-500">{isZh ? '聚合效度与区分效度' : 'Convergent & Discriminant Validity'}</p>
            <p className="text-xs text-gray-400">
              {isZh
                ? `样本量 N=${validity.sampleSize}（需 N≥${validity.minSampleSize}）`
                : `Sample N=${validity.sampleSize} (need N≥${validity.minSampleSize})`}
            </p>
          </div>
        </div>
        <button
          onClick={() => onAskAI(
            isZh ? '请解释效度分析结果，AVE和HTMT代表什么？' : 'Please explain the validity analysis results. What do AVE and HTMT mean?',
            'validity'
          )}
          className="p-2 hover:bg-teal-50 rounded-lg transition-colors group"
          title={isZh ? '询问AI关于效度' : 'Ask AI about validity'}
        >
          <HelpCircle className="w-5 h-5 text-gray-400 group-hover:text-teal-500" />
        </button>
      </div>

      {!validity.hasSufficientSample ? (
        <div className="text-center py-8">
          <Shield className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">
            {isZh
              ? `效度分析需要至少 ${validity.minSampleSize} 份有效答卷`
              : `Validity analysis requires at least ${validity.minSampleSize} valid responses`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {isZh ? `当前样本量：${validity.sampleSize}` : `Current sample: ${validity.sampleSize}`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Assessment */}
          <div className={`p-4 rounded-xl ${
            validity.overallAssessment.overallValid
              ? 'bg-green-50 border border-green-200'
              : 'bg-amber-50 border border-amber-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {validity.overallAssessment.overallValid ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600" />
              )}
              <span className={`font-medium ${
                validity.overallAssessment.overallValid ? 'text-green-700' : 'text-amber-700'
              }`}>
                {isZh
                  ? (validity.overallAssessment.overallValid ? '效度良好' : '效度需改进')
                  : (validity.overallAssessment.overallValid ? 'Good Validity' : 'Validity Needs Improvement')}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              {isZh ? validity.overallAssessment.interpretationZh : validity.overallAssessment.interpretation}
            </p>
          </div>

          {/* Convergent Validity */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              {isZh ? '聚合效度' : 'Convergent Validity'}
              <span className="text-xs text-gray-400">AVE ≥ 0.5, CR ≥ 0.7</span>
            </h4>
            {Object.keys(validity.convergentValidity).length === 0 ? (
              <p className="text-sm text-gray-400">{isZh ? '数据不足' : 'Insufficient data'}</p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(validity.convergentValidity).map(([dim, stats]) => (
                  <div
                    key={dim}
                    className={`p-3 rounded-lg border ${
                      stats.meetsAVEThreshold && stats.meetsCRThreshold
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}
                  >
                    <p className="text-sm font-medium text-gray-800 truncate" title={dim}>{dim}</p>
                    <div className="flex justify-between mt-1">
                      <div>
                        <p className="text-xs text-gray-500">AVE</p>
                        <p className={`text-sm font-bold ${stats.meetsAVEThreshold ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.ave.toFixed(3)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">CR</p>
                        <p className={`text-sm font-bold ${stats.meetsCRThreshold ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.cr.toFixed(3)}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{stats.itemCount} {isZh ? '题' : 'items'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Discriminant Validity - HTMT */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              {isZh ? '区分效度 (HTMT)' : 'Discriminant Validity (HTMT)'}
              <span className="text-xs text-gray-400">HTMT &lt; 0.85</span>
              {validity.discriminantValidity.passesHTMT ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-500" />
              )}
            </h4>
            {Object.keys(validity.discriminantValidity.htmt).length === 0 ? (
              <p className="text-sm text-gray-400">{isZh ? '需要至少2个维度' : 'Need at least 2 dimensions'}</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(validity.discriminantValidity.htmt).map(([key, htmt]) => {
                  const [dim1, dim2] = key.split('_');
                  const isHigh = htmt >= 0.85;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className="w-32 text-xs text-gray-600 truncate" title={`${dim1} × ${dim2}`}>
                        {dim1} × {dim2}
                      </span>
                      <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden relative">
                        <div
                          className={`h-full transition-all ${isHigh ? 'bg-red-400' : 'bg-teal-400'}`}
                          style={{ width: `${Math.min(htmt * 100, 100)}%` }}
                        />
                        {/* Threshold line at 0.85 */}
                        <div
                          className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                          style={{ left: '85%' }}
                        />
                      </div>
                      <span className={`w-12 text-xs text-right font-medium ${isHigh ? 'text-red-600' : 'text-gray-600'}`}>
                        {htmt.toFixed(3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">
              {isZh ? '* HTMT ≥ 0.85 表示维度间区分度不足' : '* HTMT ≥ 0.85 indicates poor discriminant validity'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

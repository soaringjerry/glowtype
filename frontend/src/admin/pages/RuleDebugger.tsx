import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { useAdminApi } from '../hooks/useAdmin';

interface TraitDimension {
  id: number;
  key: string;
  nameEn: string;
  positivePole: string;
  negativePole: string;
}

interface DimEvalResult {
  score: number;
  min?: number;
  max?: number;
  inRange: boolean;
}

interface RuleEvaluation {
  ruleId: number;
  ruleName: string;
  priority: number;
  resultTypeCode: string;
  matched: boolean;
  dimResults: Record<string, DimEvalResult>;
}

interface DebugResult {
  dimensionScores: Record<string, number>;
  resultTypeCode: string;
  matchedRuleName?: string;
  isFallback: boolean;
  debugInfo?: {
    evaluatedRules: RuleEvaluation[];
    unmatchedDims?: string[];
  };
}

export default function RuleDebugger() {
  const { t: _t } = useTranslation('admin'); // i18n ready, TODO: replace hardcoded strings
  const [dimensions, setDimensions] = useState<TraitDimension[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [result, setResult] = useState<DebugResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const api = useAdminApi();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const dims = await api.listDimensions();
      if (dims) {
        setDimensions(dims);
        // Initialize scores to 0 for each dimension
        const initialScores: Record<string, number> = {};
        dims.forEach((d: TraitDimension) => {
          initialScores[d.key] = 0;
        });
        setScores(initialScores);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleTest = async () => {
    setTesting(true);
    const data = await api.debugRules({ scores });
    if (data) {
      setResult(data);
    }
    setTesting(false);
  };

  const handleScoreChange = (dimKey: string, value: number) => {
    setScores((prev) => ({ ...prev, [dimKey]: value }));
    setResult(null); // Clear previous result when scores change
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rule Debugger</h1>
        <p className="text-gray-500">Test how dimension scores map to Glowtypes</p>
      </div>

      {/* Score Input */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Dimension Scores</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dimensions.map((dim) => (
            <div key={dim.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">{dim.key}</label>
                <span className="text-sm text-gray-500">
                  {dim.negativePole} ← → {dim.positivePole}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="1"
                  value={scores[dim.key] || 0}
                  onChange={(e) => handleScoreChange(dim.key, parseInt(e.target.value))}
                  className="flex-1 accent-purple-500"
                />
                <input
                  type="number"
                  value={scores[dim.key] || 0}
                  onChange={(e) => handleScoreChange(dim.key, parseInt(e.target.value) || 0)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                />
              </div>
            </div>
          ))}
        </div>

        {dimensions.length === 0 && (
          <p className="text-gray-400 text-center py-4">
            No dimensions defined. Create dimensions first.
          </p>
        )}

        <button
          onClick={handleTest}
          disabled={testing || dimensions.length === 0}
          className="mt-6 flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50"
        >
          {testing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          Test Rules
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">Result</h3>

          {/* Match Summary */}
          <div
            className={`p-4 rounded-xl mb-6 ${
              result.isFallback
                ? 'bg-yellow-50 border border-yellow-200'
                : result.resultTypeCode === 'Unmapped'
                ? 'bg-red-50 border border-red-200'
                : 'bg-green-50 border border-green-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {result.isFallback ? (
                <AlertTriangle className="w-6 h-6 text-yellow-600" />
              ) : result.resultTypeCode === 'Unmapped' ? (
                <XCircle className="w-6 h-6 text-red-600" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              )}
              <div>
                <p
                  className={`font-semibold text-lg ${
                    result.isFallback
                      ? 'text-yellow-800'
                      : result.resultTypeCode === 'Unmapped'
                      ? 'text-red-800'
                      : 'text-green-800'
                  }`}
                >
                  {result.resultTypeCode}
                </p>
                {result.matchedRuleName && (
                  <p className="text-sm text-gray-600">
                    Matched: {result.matchedRuleName}
                    {result.isFallback && ' (Fallback)'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Debug Info */}
          {result.debugInfo && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700">Rule Evaluation Details</h4>

              {result.debugInfo.unmatchedDims && result.debugInfo.unmatchedDims.length > 0 && (
                <div className="p-3 bg-red-50 rounded-lg text-sm text-red-700">
                  Dimensions that failed in all rules: {result.debugInfo.unmatchedDims.join(', ')}
                </div>
              )}

              <div className="space-y-3">
                {result.debugInfo.evaluatedRules.map((rule) => (
                  <div
                    key={rule.ruleId}
                    className={`p-4 rounded-lg border ${
                      rule.matched
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {rule.matched ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-800">{rule.ruleName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">
                          Priority: {rule.priority}
                        </span>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
                          {rule.resultTypeCode}
                        </span>
                      </div>
                    </div>

                    {/* Dimension Results */}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Object.entries(rule.dimResults).map(([dim, res]) => (
                        <span
                          key={dim}
                          className={`text-xs px-2 py-1 rounded ${
                            res.inRange
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {dim}: {res.score}
                          {res.min !== undefined && ` >= ${res.min}`}
                          {res.max !== undefined && ` <= ${res.max}`}
                          {res.inRange ? ' OK' : ' FAIL'}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

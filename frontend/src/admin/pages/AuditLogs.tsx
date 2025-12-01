import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Shield, ScrollText, Loader2, X, AlertTriangle, AlertCircle, Info, ChevronRight } from 'lucide-react';
import type { AdminAuditLog } from '../hooks/useAdmin';
import { userHasPermission, useAdminApi, useAdminAuth } from '../hooks/useAdmin';

// Risk level badge component
function RiskBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    low: 'bg-gray-100 text-gray-600',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  const icons: Record<string, ReactNode> = {
    low: <Info className="w-3 h-3" />,
    medium: <Info className="w-3 h-3" />,
    high: <AlertTriangle className="w-3 h-3" />,
    critical: <AlertCircle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[level] || colors.low}`}>
      {icons[level] || icons.low}
      {level}
    </span>
  );
}

// Diff modal component
function DiffModal({
  isOpen,
  onClose,
  dataDiff,
  resourceType,
  resourceId
}: {
  isOpen: boolean;
  onClose: () => void;
  dataDiff?: Record<string, { before?: any; after?: any }>;
  resourceType?: string;
  resourceId?: number;
}) {
  const { t } = useTranslation('admin');

  if (!isOpen) return null;

  const hasDiff = dataDiff && Object.keys(dataDiff).length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('audit.diffTitle')}</h3>
            {resourceType && (
              <p className="text-sm text-gray-500">
                {resourceType} {resourceId ? `#${resourceId}` : ''}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {!hasDiff ? (
            <p className="text-gray-500 text-center py-8">{t('audit.noDiff')}</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(dataDiff!).map(([field, change]) => (
                <div key={field} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="font-medium text-gray-700 mb-2">{field}</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">{t('audit.before')}</div>
                      <div className="bg-red-50 border border-red-100 rounded p-2 text-red-800 break-words">
                        {change.before !== undefined ? (
                          typeof change.before === 'object'
                            ? JSON.stringify(change.before, null, 2)
                            : String(change.before)
                        ) : (
                          <span className="text-gray-400 italic">null</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">{t('audit.after')}</div>
                      <div className="bg-green-50 border border-green-100 rounded p-2 text-green-800 break-words">
                        {change.after !== undefined ? (
                          typeof change.after === 'object'
                            ? JSON.stringify(change.after, null, 2)
                            : String(change.after)
                        ) : (
                          <span className="text-gray-400 italic">null</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuditLogs() {
  const { t } = useTranslation('admin');
  const { currentUser } = useAdminAuth();
  const { listAuditLogs, loading } = useAdminApi();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<AdminAuditLog | null>(null);

  const canView = useMemo(() => userHasPermission(currentUser, 'audit.view'), [currentUser]);

  useEffect(() => {
    if (!canView) return;
    const load = async () => {
      const res = await listAuditLogs(200);
      if (res) setLogs(res);
    };
    load();
  }, [canView, listAuditLogs]);

  if (!canView) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{t('accessDenied.title')}</h2>
          <p className="text-sm text-gray-500">{t('accessDenied.desc')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('audit.title')}</h1>
          <p className="text-gray-500">{t('audit.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ScrollText className="w-4 h-4 text-purple-500" />
          {t('audit.latest')}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            {t('common.loading')}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-6 text-gray-500">{t('audit.empty')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.time')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.user')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.riskLevel')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.action')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.path')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.ip')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.changes')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {t('audit.details')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100 text-sm">
                {logs.map((log) => {
                  let meta: any = {};
                  if (log.metadata) {
                    if (typeof log.metadata === 'string') {
                      try {
                        meta = JSON.parse(log.metadata);
                      } catch {
                        meta = {};
                      }
                    } else {
                      meta = log.metadata;
                    }
                  }

                  const hasDiff = log.dataDiff && Object.keys(log.dataDiff).length > 0;

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock3 className="w-4 h-4 text-gray-400" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{log.username}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RiskBadge level={log.riskLevel || 'low'} />
                      </td>
                      <td className="px-4 py-3 text-gray-700">{log.action}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-700">{log.method}</span>
                          <span>{log.path}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-sm font-semibold ${
                            log.statusCode >= 400 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {log.statusCode}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{log.ip || '-'}</td>
                      <td className="px-4 py-3">
                        {hasDiff ? (
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 text-xs font-medium"
                          >
                            {t('audit.viewDiff')}
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 text-xs max-w-sm">
                        <details className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                          <summary className="cursor-pointer text-gray-700">
                            {meta.durationMs ? `${meta.durationMs}ms` : t('audit.details')}
                          </summary>
                          <pre className="mt-2 whitespace-pre-wrap break-words text-gray-700">
                            {JSON.stringify(
                              {
                                pathParams: meta.pathParams,
                                query: meta.query,
                                requestBody: meta.requestBody,
                                responseSample: meta.responseSample,
                                status: meta.status,
                                adminRole: meta.adminRole,
                                ip: meta.ip,
                                durationMs: meta.durationMs,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Diff Modal */}
      <DiffModal
        isOpen={selectedLog !== null}
        onClose={() => setSelectedLog(null)}
        dataDiff={selectedLog?.dataDiff}
        resourceType={selectedLog?.resourceType}
        resourceId={selectedLog?.resourceId}
      />
    </div>
  );
}

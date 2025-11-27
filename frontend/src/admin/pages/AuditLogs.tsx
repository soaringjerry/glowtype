import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock3, Shield, ScrollText, Loader2 } from 'lucide-react';
import type { AdminAuditLog } from '../hooks/useAdmin';
import { useAdminApi, useAdminAuth } from '../hooks/useAdmin';

export default function AuditLogs() {
  const { t } = useTranslation('admin');
  const { currentUser } = useAdminAuth();
  const { listAuditLogs, loading } = useAdminApi();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);

  const isSuper = useMemo(() => currentUser?.role === 'superadmin', [currentUser]);

  useEffect(() => {
    if (!isSuper) return;
    const load = async () => {
      const res = await listAuditLogs(200);
      if (res) setLogs(res);
    };
    load();
  }, [isSuper, listAuditLogs]);

  if (!isSuper) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-amber-100 p-6 flex items-center gap-3">
        <Shield className="w-5 h-5 text-amber-500" />
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{t('audit.superOnlyTitle')}</h2>
          <p className="text-sm text-gray-500">{t('audit.superOnlyDesc')}</p>
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
                    {t('audit.meta')}
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

                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Clock3 className="w-4 h-4 text-gray-400" />
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">{log.username}</td>
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
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                        {meta.durationMs ? `${meta.durationMs}ms` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

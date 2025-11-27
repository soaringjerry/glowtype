import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, PlusCircle, Loader2, AlertCircle, Users } from 'lucide-react';
import type { AdminRole, AdminUser } from '../hooks/useAdmin';
import { useAdminApi, useAdminAuth } from '../hooks/useAdmin';

interface NewAdminForm {
  username: string;
  password: string;
  role: AdminRole;
}

export default function AdminUsers() {
  const { t } = useTranslation('admin');
  const { currentUser } = useAdminAuth();
  const { listAdmins, createAdmin, loading, error } = useAdminApi();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<NewAdminForm>({ username: '', password: '', role: 'admin' });
  const [success, setSuccess] = useState<string | null>(null);

  const isSuper = useMemo(() => currentUser?.role === 'superadmin', [currentUser]);

  useEffect(() => {
    if (!isSuper) return;
    const load = async () => {
      const res = await listAdmins();
      if (res) setAdmins(res);
    };
    load();
  }, [isSuper, listAdmins]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    const res = await createAdmin(form);
    if (res) {
      setAdmins((prev) => [res, ...prev]);
      setForm({ username: '', password: '', role: 'admin' });
      setSuccess(t('adminUsers.created', { user: res.username }));
    }
  };

  if (!isSuper) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-3 border border-amber-100">
          <Shield className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('adminUsers.superOnlyTitle')}</h2>
            <p className="text-sm text-gray-500">{t('adminUsers.superOnlyDesc')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('adminUsers.title')}</h1>
          <p className="text-gray-500">{t('adminUsers.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Shield className="w-4 h-4 text-purple-500" />
          {t('adminUsers.superBadge')}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <PlusCircle className="w-5 h-5 text-purple-500" />
            <div>
              <h3 className="font-semibold text-gray-800">{t('adminUsers.addTitle')}</h3>
              <p className="text-xs text-gray-500">{t('adminUsers.addHint')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('adminUsers.username')}</label>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder="admin@example"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('adminUsers.password')}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
                placeholder={t('adminUsers.passwordPlaceholder')}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('adminUsers.role')}</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as AdminRole }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white"
              >
                <option value="admin">{t('roles.admin')}</option>
                <option value="superadmin">{t('roles.superadmin')}</option>
              </select>
            </div>

            {(error || success) && (
              <div
                className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${
                  error ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                }`}
              >
                {error ? <AlertCircle className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                <span>{error || success}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !form.username || !form.password}
              className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('adminUsers.create')
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-purple-500" />
            <h3 className="font-semibold text-gray-800">{t('adminUsers.listTitle')}</h3>
          </div>

          {loading && admins.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {t('common.loading')}
            </div>
          ) : admins.length === 0 ? (
            <div className="text-gray-500 text-sm bg-gray-50 rounded-xl p-4">
              {t('adminUsers.empty')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('adminUsers.username')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('adminUsers.role')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('adminUsers.lastLogin')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('adminUsers.lastIp')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                  {admins.map((admin) => (
                    <tr key={admin.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{admin.username}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                            admin.role === 'superadmin'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {admin.role === 'superadmin' ? t('roles.superadmin') : t('roles.admin')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : t('adminUsers.never')}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{admin.lastLoginIp || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

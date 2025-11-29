import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, PlusCircle, Loader2, AlertCircle, Users, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import type { AdminRole, AdminUser } from '../hooks/useAdmin';
import { isReadOnlyRole, roleHasPermission, useAdminApi, useAdminAuth } from '../hooks/useAdmin';

interface NewAdminForm {
  username: string;
  password: string;
  role: AdminRole;
}

export default function AdminUsers() {
  const { t } = useTranslation('admin');
  const { currentUser } = useAdminAuth();
  const { listAdmins, createAdmin, updateAdmin, loading, error } = useAdminApi();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<NewAdminForm>({ username: '', password: '', role: 'admin' });
  const [success, setSuccess] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { role: AdminRole; isActive: boolean }>>({});

  const canManage = useMemo(() => roleHasPermission(currentUser?.role, 'admin.manage'), [currentUser]);
  const readOnly = isReadOnlyRole(currentUser?.role);
  const isSelf = (id: number) => currentUser?.id === id;

  const roleOptions: { value: AdminRole; label: string }[] = [
    { value: 'viewer', label: t('roles.viewer') },
    { value: 'admin', label: t('roles.admin') },
    { value: 'content_admin', label: t('roles.content_admin') },
    { value: 'data_admin', label: t('roles.data_admin') },
    { value: 'analyst', label: t('roles.analyst') },
    { value: 'superadmin', label: t('roles.superadmin') },
  ];

  useEffect(() => {
    if (!canManage) return;
    const load = async () => {
      const res = await listAdmins();
      if (res) setAdmins(res);
    };
    load();
  }, [canManage, listAdmins]);

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

  const getDraft = (admin: AdminUser) =>
    drafts[admin.id] ?? { role: admin.role, isActive: admin.isActive ?? true };

  const handleUpdate = async (admin: AdminUser) => {
    const draft = getDraft(admin);
    const payload: Partial<Pick<AdminUser, 'role' | 'isActive'>> = {};
    if (draft.role !== admin.role) payload.role = draft.role;
    if ((admin.isActive ?? true) !== draft.isActive) payload.isActive = draft.isActive;
    if (Object.keys(payload).length === 0) return;

    setSavingId(admin.id);
    const res = await updateAdmin(admin.id, payload);
    setSavingId(null);
    if (res) {
      setAdmins((prev) => prev.map((a) => (a.id === admin.id ? { ...a, ...res } : a)));
      setDrafts((prev) => {
        const copy = { ...prev };
        delete copy[admin.id];
        return copy;
      });
      setSuccess(t('adminUsers.updated', { user: admin.username }));
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl shadow-sm p-6 flex items-center gap-3 border border-amber-100">
          <Shield className="w-5 h-5 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold text-gray-800">{t('accessDenied.title')}</h2>
            <p className="text-sm text-gray-500">{t('accessDenied.desc')}</p>
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

      {readOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm">
          {t('common.readOnlyHint')}
        </div>
      )}

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
                disabled={readOnly}
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
                disabled={readOnly}
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
                disabled={readOnly}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition bg-white"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
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
              disabled={loading || !form.username || !form.password || readOnly}
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
                      {t('adminUsers.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('adminUsers.lastLogin')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('adminUsers.lastIp')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {t('adminUsers.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100 text-sm">
                  {admins.map((admin) => {
                    const draft = getDraft(admin);
                    const hasChanges =
                      draft.role !== admin.role || (admin.isActive ?? true) !== draft.isActive;
                    const disabled = readOnly || isSelf(admin.id);
                    return (
                      <tr key={admin.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{admin.username}</td>
                        <td className="px-4 py-3">
                          <select
                            value={draft.role}
                            disabled={disabled}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [admin.id]: { ...draft, role: e.target.value as AdminRole },
                              }))
                            }
                            className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                          >
                            {roleOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() =>
                              setDrafts((prev) => ({
                                ...prev,
                                [admin.id]: { ...draft, isActive: !draft.isActive },
                              }))
                            }
                            className="flex items-center gap-2 text-sm text-gray-700 disabled:opacity-50"
                          >
                            {draft.isActive ? (
                              <>
                                <ToggleRight className="w-5 h-5 text-green-500" />
                                {t('adminUsers.active')}
                              </>
                            ) : (
                              <>
                                <ToggleLeft className="w-5 h-5 text-gray-400" />
                                {t('adminUsers.inactive')}
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : t('adminUsers.never')}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{admin.lastLoginIp || '-'}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={!hasChanges || savingId === admin.id || disabled}
                            onClick={() => handleUpdate(admin)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {savingId === admin.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {t('adminUsers.save')}
                          </button>
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
    </div>
  );
}

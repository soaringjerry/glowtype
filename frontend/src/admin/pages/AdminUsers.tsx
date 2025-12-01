import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  PlusCircle,
  Loader2,
  AlertCircle,
  Users,
  ToggleLeft,
  ToggleRight,
  Save,
  ChevronDown,
  ChevronUp,
  Settings2,
  RotateCcw,
  KeyRound,
  RefreshCw,
} from 'lucide-react';
import type { AdminRole, AdminUser, AdminPermission } from '../hooks/useAdmin';
import {
  isReadOnlyRole,
  userHasPermission,
  useAdminApi,
  useAdminAuth,
  ALL_PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_LABELS,
  getRoleDefaultPermissions,
} from '../hooks/useAdmin';

interface NewAdminForm {
  username: string;
  password: string;
  role: AdminRole;
  permissions: string[];
  useCustomPermissions: boolean;
}

interface AdminDraft {
  role: AdminRole;
  isActive: boolean;
  permissions: string[];
  useCustomPermissions: boolean;
  twoFactorRequired?: boolean;
}

// Permission checkbox component
function PermissionCheckbox({
  permission,
  checked,
  onChange,
  disabled,
}: {
  permission: AdminPermission;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition cursor-pointer ${
        checked
          ? 'bg-purple-50 border-purple-300 text-purple-700'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
      />
      <span className="text-sm">{PERMISSION_LABELS[permission]}</span>
    </label>
  );
}

// Permission selector panel
function PermissionSelector({
  selectedPermissions,
  onChange,
  disabled,
  onResetToRole,
  roleName,
}: {
  selectedPermissions: string[];
  onChange: (permissions: string[]) => void;
  disabled?: boolean;
  onResetToRole?: () => void;
  roleName?: string;
}) {
  const handleToggle = (perm: AdminPermission, checked: boolean) => {
    if (checked) {
      onChange([...selectedPermissions, perm]);
    } else {
      onChange(selectedPermissions.filter((p) => p !== perm));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">自定义权限</span>
        {onResetToRole && (
          <button
            type="button"
            onClick={onResetToRole}
            disabled={disabled}
            className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            重置为{roleName ? ROLE_LABELS[roleName as AdminRole] : '角色'}默认
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {ALL_PERMISSIONS.map((perm) => (
          <PermissionCheckbox
            key={perm}
            permission={perm}
            checked={selectedPermissions.includes(perm)}
            onChange={(checked) => handleToggle(perm, checked)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const { t } = useTranslation('admin');
  const { currentUser } = useAdminAuth();
  const { listAdmins, createAdmin, updateAdmin, manageUser2FA, loading, error } = useAdminApi();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<NewAdminForm>({
    username: '',
    password: '',
    role: 'admin',
    permissions: getRoleDefaultPermissions('admin'),
    useCustomPermissions: false,
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, AdminDraft>>({});
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [showCreatePermissions, setShowCreatePermissions] = useState(false);
  const [managing2FAId, setManaging2FAId] = useState<number | null>(null);

  const canManage = useMemo(() => userHasPermission(currentUser, 'admin.manage'), [currentUser]);
  const readOnly = isReadOnlyRole(currentUser?.role);
  const isSelf = (id: number) => currentUser?.id === id;
  const isSuperadmin = currentUser?.role === 'superadmin';

  const roleOptions: { value: AdminRole; label: string }[] = [
    { value: 'viewer', label: t('roles.viewer') },
    { value: 'admin', label: t('roles.admin') },
    { value: 'content_admin', label: t('roles.content_admin') },
    { value: 'data_admin', label: t('roles.data_admin') },
    { value: 'analyst', label: t('roles.analyst') },
    { value: 'crisis_admin', label: t('roles.crisis_admin') },
    // Only superadmin can create superadmin
    ...(isSuperadmin ? [{ value: 'superadmin' as AdminRole, label: t('roles.superadmin') }] : []),
  ];

  useEffect(() => {
    if (!canManage) return;
    const load = async () => {
      const res = await listAdmins();
      if (res) setAdmins(res);
    };
    load();
  }, [canManage, listAdmins]);

  // Update permissions when role changes in create form
  const handleRoleChange = (role: AdminRole) => {
    setForm((f) => ({
      ...f,
      role,
      permissions: f.useCustomPermissions ? f.permissions : getRoleDefaultPermissions(role),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(null);
    const payload: { username: string; password: string; role: AdminRole; permissions?: string[] } = {
      username: form.username,
      password: form.password,
      role: form.role,
    };
    // Only send custom permissions if enabled and different from role defaults
    if (form.useCustomPermissions) {
      payload.permissions = form.permissions;
    }
    const res = await createAdmin(payload);
    if (res) {
      setAdmins((prev) => [res, ...prev]);
      setForm({
        username: '',
        password: '',
        role: 'admin',
        permissions: getRoleDefaultPermissions('admin'),
        useCustomPermissions: false,
      });
      setShowCreatePermissions(false);
      setSuccess(t('adminUsers.created', { user: res.username }));
    }
  };

  const getDraft = (admin: AdminUser): AdminDraft => {
    if (drafts[admin.id]) return drafts[admin.id];
    const hasCustom = admin.permissions && admin.permissions.length > 0;
    return {
      role: admin.role,
      isActive: admin.isActive ?? true,
      permissions: admin.effectivePermissions ?? getRoleDefaultPermissions(admin.role),
      useCustomPermissions: hasCustom ?? false,
      twoFactorRequired: admin.twoFactorRequired ?? false,
    };
  };

  // Handle 2FA management for a user
  const handleManage2FA = async (adminId: number, action: 'require' | 'unrequire' | 'reset') => {
    setManaging2FAId(adminId);
    const data = action === 'reset' ? { reset: true } : { forceEnabled: action === 'require' };
    const result = await manageUser2FA(adminId, data);
    if (result) {
      // Update the admin in the list
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === adminId
            ? {
                ...a,
                twoFactorRequired: action === 'require' ? true : action === 'unrequire' ? false : a.twoFactorRequired,
                twoFactorEnabled: action === 'reset' ? false : a.twoFactorEnabled,
                twoFactorPending: action === 'reset' ? false : a.twoFactorPending,
              }
            : a
        )
      );
      setSuccess(
        action === 'reset'
          ? t('adminUsers.2faReset', { user: admins.find((a) => a.id === adminId)?.username })
          : action === 'require'
            ? t('adminUsers.2faRequired', { user: admins.find((a) => a.id === adminId)?.username })
            : t('adminUsers.2faUnrequired', { user: admins.find((a) => a.id === adminId)?.username })
      );
    }
    setManaging2FAId(null);
  };

  const handleDraftRoleChange = (admin: AdminUser, role: AdminRole) => {
    const draft = getDraft(admin);
    setDrafts((prev) => ({
      ...prev,
      [admin.id]: {
        ...draft,
        role,
        permissions: draft.useCustomPermissions ? draft.permissions : getRoleDefaultPermissions(role),
      },
    }));
  };

  const handleUpdate = async (admin: AdminUser) => {
    const draft = getDraft(admin);
    const payload: { role?: AdminRole; isActive?: boolean; permissions?: string[] } = {};

    if (draft.role !== admin.role) payload.role = draft.role;
    if ((admin.isActive ?? true) !== draft.isActive) payload.isActive = draft.isActive;

    // Handle permissions
    const hasCustom = admin.permissions && admin.permissions.length > 0;
    if (draft.useCustomPermissions) {
      // Check if permissions actually changed
      const currentPerms = admin.effectivePermissions ?? [];
      const permsChanged =
        draft.permissions.length !== currentPerms.length ||
        !draft.permissions.every((p) => currentPerms.includes(p));
      if (permsChanged || !hasCustom) {
        payload.permissions = draft.permissions;
      }
    } else if (hasCustom) {
      // Clear custom permissions (use role defaults) - send empty array
      payload.permissions = [];
    }

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

  const toggleRowExpanded = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
        {/* Create Admin Form */}
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
                onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
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

            {/* Custom permissions toggle */}
            <div className="border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowCreatePermissions(!showCreatePermissions)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-purple-600 transition"
              >
                <Settings2 className="w-4 h-4" />
                <span>自定义权限</span>
                {showCreatePermissions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showCreatePermissions && (
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.useCustomPermissions}
                      onChange={(e) => {
                        const useCustom = e.target.checked;
                        setForm((f) => ({
                          ...f,
                          useCustomPermissions: useCustom,
                          permissions: useCustom ? f.permissions : getRoleDefaultPermissions(f.role),
                        }));
                      }}
                      disabled={readOnly}
                      className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-gray-700">使用自定义权限（而非角色默认）</span>
                  </label>

                  {form.useCustomPermissions && (
                    <PermissionSelector
                      selectedPermissions={form.permissions}
                      onChange={(perms) => setForm((f) => ({ ...f, permissions: perms }))}
                      disabled={readOnly}
                      onResetToRole={() =>
                        setForm((f) => ({ ...f, permissions: getRoleDefaultPermissions(f.role) }))
                      }
                      roleName={form.role}
                    />
                  )}
                </div>
              )}
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

        {/* Admin List */}
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
            <div className="text-gray-500 text-sm bg-gray-50 rounded-xl p-4">{t('adminUsers.empty')}</div>
          ) : (
            <div className="space-y-3">
              {admins.map((admin) => {
                const draft = getDraft(admin);
                const hasChanges =
                  draft.role !== admin.role ||
                  (admin.isActive ?? true) !== draft.isActive ||
                  (draft.useCustomPermissions &&
                    JSON.stringify(draft.permissions.sort()) !==
                      JSON.stringify((admin.effectivePermissions ?? []).sort())) ||
                  (!draft.useCustomPermissions && admin.permissions && admin.permissions.length > 0);
                const disabled = readOnly || isSelf(admin.id);
                const isExpanded = expandedRows.has(admin.id);
                const canAssignSuper = isSuperadmin || admin.role !== 'superadmin';

                return (
                  <div
                    key={admin.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-purple-200 transition"
                  >
                    {/* Main row */}
                    <div className="flex items-center gap-4 p-4 bg-white">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-800 truncate">{admin.username}</div>
                        <div className="text-xs text-gray-500">
                          {admin.lastLoginAt
                            ? `上次登录: ${new Date(admin.lastLoginAt).toLocaleString()}`
                            : t('adminUsers.never')}
                          {admin.lastLoginIp && ` · ${admin.lastLoginIp}`}
                        </div>
                      </div>

                      {/* 2FA Status Indicator */}
                      <div
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs ${
                          admin.twoFactorEnabled
                            ? 'bg-green-100 text-green-700'
                            : admin.twoFactorRequired
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                        title={
                          admin.twoFactorEnabled
                            ? t('adminUsers.2faEnabled', '2FA 已启用')
                            : admin.twoFactorRequired
                              ? t('adminUsers.2faRequiredNotSet', '要求2FA但未设置')
                              : t('adminUsers.2faDisabled', '2FA 未启用')
                        }
                      >
                        {admin.twoFactorEnabled ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <ShieldOff className="w-3 h-3" />
                        )}
                        <span className="hidden sm:inline">
                          {admin.twoFactorEnabled ? '2FA' : admin.twoFactorRequired ? '要求' : '无'}
                        </span>
                      </div>

                      <select
                        value={draft.role}
                        disabled={disabled || !canAssignSuper}
                        onChange={(e) => handleDraftRoleChange(admin, e.target.value as AdminRole)}
                        className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
                      >
                        {roleOptions.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            disabled={opt.value === 'superadmin' && !isSuperadmin}
                          >
                            {opt.label}
                          </option>
                        ))}
                        {/* Keep superadmin option visible for existing superadmins */}
                        {admin.role === 'superadmin' && !isSuperadmin && (
                          <option value="superadmin">{t('roles.superadmin')}</option>
                        )}
                      </select>

                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setDrafts((prev) => ({
                            ...prev,
                            [admin.id]: { ...draft, isActive: !draft.isActive },
                          }))
                        }
                        className="flex items-center gap-1 text-sm text-gray-700 disabled:opacity-50"
                      >
                        {draft.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleRowExpanded(admin.id)}
                        className="p-2 text-gray-400 hover:text-purple-600 transition"
                        title="权限详情"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        disabled={!hasChanges || savingId === admin.id || disabled}
                        onClick={() => handleUpdate(admin)}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingId === admin.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {t('adminUsers.save')}
                      </button>
                    </div>

                    {/* Expanded permissions panel */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={draft.useCustomPermissions}
                              onChange={(e) => {
                                const useCustom = e.target.checked;
                                setDrafts((prev) => ({
                                  ...prev,
                                  [admin.id]: {
                                    ...draft,
                                    useCustomPermissions: useCustom,
                                    permissions: useCustom
                                      ? draft.permissions
                                      : getRoleDefaultPermissions(draft.role),
                                  },
                                }));
                              }}
                              disabled={disabled || admin.role === 'superadmin'}
                              className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                            />
                            <span className="text-gray-700">使用自定义权限</span>
                          </label>
                          {admin.permissions && admin.permissions.length > 0 && (
                            <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded">
                              已自定义
                            </span>
                          )}
                        </div>

                        {admin.role === 'superadmin' ? (
                          <div className="text-sm text-gray-500 italic">超级管理员拥有所有权限</div>
                        ) : draft.useCustomPermissions ? (
                          <PermissionSelector
                            selectedPermissions={draft.permissions}
                            onChange={(perms) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [admin.id]: { ...draft, permissions: perms },
                              }))
                            }
                            disabled={disabled}
                            onResetToRole={() =>
                              setDrafts((prev) => ({
                                ...prev,
                                [admin.id]: { ...draft, permissions: getRoleDefaultPermissions(draft.role) },
                              }))
                            }
                            roleName={draft.role}
                          />
                        ) : (
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600">
                              当前权限（{ROLE_LABELS[draft.role]}默认）:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {(admin.effectivePermissions ?? getRoleDefaultPermissions(admin.role)).map(
                                (perm) => (
                                  <span
                                    key={perm}
                                    className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                                  >
                                    {PERMISSION_LABELS[perm as AdminPermission] || perm}
                                  </span>
                                )
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2FA Management Section - Superadmin only */}
                        {isSuperadmin && !isSelf(admin.id) && (
                          <div className="border-t border-gray-200 pt-4 mt-4">
                            <div className="flex items-center gap-2 mb-3">
                              <KeyRound className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-700">
                                {t('adminUsers.2faManagement', '两步验证管理')}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                              {/* 2FA Status */}
                              <div className="text-sm text-gray-600">
                                {admin.twoFactorEnabled
                                  ? t('adminUsers.2faStatusEnabled', '状态: 已启用')
                                  : admin.twoFactorPending
                                    ? t('adminUsers.2faStatusPending', '状态: 设置未完成')
                                    : t('adminUsers.2faStatusDisabled', '状态: 未启用')}
                                {admin.twoFactorRequired && (
                                  <span className="ml-2 text-amber-600">
                                    ({t('adminUsers.required', '要求启用')})
                                  </span>
                                )}
                              </div>

                              {/* Require/Unrequire 2FA */}
                              {admin.twoFactorRequired ? (
                                <button
                                  type="button"
                                  onClick={() => handleManage2FA(admin.id, 'unrequire')}
                                  disabled={managing2FAId === admin.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                >
                                  {managing2FAId === admin.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ShieldOff className="w-3 h-3" />
                                  )}
                                  {t('adminUsers.unrequire2FA', '取消强制')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleManage2FA(admin.id, 'require')}
                                  disabled={managing2FAId === admin.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 disabled:opacity-50"
                                >
                                  {managing2FAId === admin.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="w-3 h-3" />
                                  )}
                                  {t('adminUsers.require2FA', '强制启用')}
                                </button>
                              )}

                              {/* Reset 2FA - show when enabled OR when stuck in pending state */}
                              {(admin.twoFactorEnabled || admin.twoFactorPending) && (
                                <button
                                  type="button"
                                  onClick={() => handleManage2FA(admin.id, 'reset')}
                                  disabled={managing2FAId === admin.id}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 disabled:opacity-50"
                                >
                                  {managing2FAId === admin.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  {t('adminUsers.reset2FA', '重置2FA')}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

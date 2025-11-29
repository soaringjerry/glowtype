import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Settings,
  Shield,
  ShieldCheck,
  ShieldOff,
  Key,
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  Trash2,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  Globe,
} from 'lucide-react';
import { useAdminApi, useAdminAuth, type TwoFactorStatus, type TrustedDevice, type Verify2FAResponse } from '../hooks/useAdmin';
import { TwoFactorSetup } from '../components/TwoFactorSetup';

export default function AdminSettings() {
  const { t } = useTranslation('admin');
  const { currentUser, updateToken } = useAdminAuth();
  const api = useAdminApi();

  // 2FA State
  const [twoFAStatus, setTwoFAStatus] = useState<TwoFactorStatus | null>(null);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loading2FA, setLoading2FA] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [setupData, setSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [setupCurrentCode, setSetupCurrentCode] = useState('');
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [regeneratingCodes, setRegeneratingCodes] = useState(false);
  const [newRecoveryCodes, setNewRecoveryCodes] = useState<string[] | null>(null);
  const [revokingDevice, setRevokingDevice] = useState<number | null>(null);
  const [showRecoveryCodes, setShowRecoveryCodes] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Track loading to prevent race conditions
  const loadingRef = useRef(false);

  // Load 2FA status and trusted devices
  const load2FAData = async () => {
    if (loadingRef.current) return; // Prevent concurrent calls
    loadingRef.current = true;
    setLoading2FA(true);
    try {
      const status = await api.get2FAStatus();
      if (status) {
        setTwoFAStatus(status);
        if (status.enabled) {
          const devices = await api.listTrustedDevices();
          if (devices) {
            setTrustedDevices(devices);
          }
        } else {
          setTrustedDevices([]);
        }
      }
    } finally {
      setLoading2FA(false);
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    load2FAData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start 2FA Setup
  const handleStart2FASetup = async () => {
    setSetupLoading(true);
    setSetupError(null);
    const result = await api.setup2FA(twoFAStatus?.enabled ? setupCurrentCode.trim() || undefined : undefined);
    if (result) {
      setSetupData({ qrCode: result.qrCode, secret: result.secret });
      setShowSetup(true);
      setSetupCurrentCode('');
    } else {
      setSetupError(api.error || t('twoFactor.setupError', '设置失败，请重试'));
    }
    setSetupLoading(false);
  };

  // Verify 2FA Setup
  const handleVerify2FA = async (code: string) => {
    const result = await api.verify2FA(code) as Verify2FAResponse | null;
    if (result?.success) {
      // Update token if a new one was returned (token_version changed)
      if (result.token) {
        updateToken(result.token);
      }
      // Don't close modal here - let TwoFactorSetup show recovery codes first
      // Modal will be closed when user clicks "Done" in the recovery codes step
      await load2FAData();
      return { success: true, recoveryCodes: result.recoveryCodes };
    }
    return { success: false };
  };

  // Called when user finishes 2FA setup (after viewing recovery codes)
  const handleSetupComplete = () => {
    setShowSetup(false);
    setSetupData(null);
  };

  // Disable 2FA
  const handleDisable2FA = async () => {
    if (!disableCode.trim()) return;
    setDisabling2FA(true);
    const result = await api.disable2FA(disableCode.trim()) as { success: boolean; token?: string } | null;
    if (result?.success) {
      // Update token if a new one was returned (token_version changed)
      if (result.token) {
        updateToken(result.token);
      }
      setShowDisableConfirm(false);
      setDisableCode('');
      await load2FAData();
    }
    setDisabling2FA(false);
  };

  // Regenerate Recovery Codes - shows a prompt for current 2FA code first
  const [showRegeneratePrompt, setShowRegeneratePrompt] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  const handleRegenerateRecoveryCodes = async () => {
    if (!regenerateCode.trim()) return;
    setRegeneratingCodes(true);
    setRegenerateError(null);
    const result = await api.regenerateRecoveryCodes(regenerateCode.trim());
    if (result?.recoveryCodes) {
      setNewRecoveryCodes(result.recoveryCodes);
      setShowRecoveryCodes(true);
      setShowRegeneratePrompt(false);
      setRegenerateCode('');
    } else {
      setRegenerateError(api.error || t('settings.regenerateFailed', '重新生成失败，请检查验证码'));
    }
    setRegeneratingCodes(false);
  };

  // Superadmin self-reset 2FA
  const [resettingSelf, setResettingSelf] = useState(false);
  const handleSuperadminResetSelf = async () => {
    if (!currentUser?.id) return;
    setResettingSelf(true);
    await api.manageUser2FA(currentUser.id, { reset: true, forceEnabled: false });
    setResettingSelf(false);
    await load2FAData();
  };

  // Revoke Trusted Device
  const handleRevokeDevice = async (deviceId: number) => {
    setRevokingDevice(deviceId);
    const result = await api.revokeTrustedDevice(deviceId);
    if (result?.success) {
      setTrustedDevices(devices => devices.filter(d => d.id !== deviceId));
    }
    setRevokingDevice(null);
  };

  // Revoke All Devices
  const handleRevokeAllDevices = async () => {
    const result = await api.revokeAllTrustedDevices();
    if (result?.success) {
      setTrustedDevices([]);
    }
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordMismatch', '新密码与确认密码不匹配'));
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError(t('settings.passwordTooShort', '密码长度至少8位'));
      return;
    }

    setChangingPassword(true);
    const success = await api.changePassword(currentPassword, newPassword, confirmPassword);
    if (success) {
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 3000);
    } else {
      setPasswordError(api.error || t('settings.passwordChangeFailed', '密码修改失败'));
    }
    setChangingPassword(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-7 h-7" />
          {t('settings.title', '个人设置')}
        </h1>
        <p className="text-gray-500">{t('settings.subtitle', '管理您的账户安全设置')}</p>
      </div>

      {/* 2FA Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${twoFAStatus?.enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
              {twoFAStatus?.enabled ? (
                <ShieldCheck className="w-6 h-6 text-green-600" />
              ) : (
                <Shield className="w-6 h-6 text-gray-500" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {t('settings.twoFactorAuth', '两步验证')}
              </h2>
              <p className="text-sm text-gray-500">
                {twoFAStatus?.enabled
                  ? t('settings.twoFactorEnabled', '已启用两步验证')
                  : t('settings.twoFactorDisabled', '未启用两步验证')}
              </p>
            </div>
          </div>
          <button
            onClick={load2FAData}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading2FA ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : twoFAStatus?.enabled ? (
          <div className="space-y-4">
            {/* 2FA Status Info */}
            {twoFAStatus.verifiedAt && (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {t('settings.enabledAt', '启用时间')}: {new Date(twoFAStatus.verifiedAt).toLocaleString()}
              </div>
            )}

            {/* Recovery Codes Info */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {t('settings.recoveryCodes', '恢复码')}
                </span>
                <span className="text-sm text-gray-500">
                  {t('settings.remainingCodes', '剩余')}: {twoFAStatus.recoveryCodesLeft}
                </span>
              </div>
              <button
                onClick={() => setShowRegeneratePrompt(true)}
                disabled={regeneratingCodes}
                className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
              >
                {regeneratingCodes ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {t('settings.regenerateCodes', '重新生成恢复码')}
              </button>
            </div>

            {/* Regenerate Recovery Codes Prompt */}
            {showRegeneratePrompt && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <div className="text-center mb-4">
                    <RefreshCw className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                    <h3 className="text-lg font-bold text-gray-800">
                      {t('settings.regenerateCodes', '重新生成恢复码')}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('settings.enterCodeToRegenerate', '请输入验证码以重新生成恢复码')}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={regenerateCode}
                    onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-center text-xl tracking-widest font-mono mb-4"
                    autoFocus
                  />
                  {regenerateError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      {regenerateError}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowRegeneratePrompt(false);
                        setRegenerateCode('');
                        setRegenerateError(null);
                      }}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                    >
                      {t('common.cancel', '取消')}
                    </button>
                    <button
                      onClick={handleRegenerateRecoveryCodes}
                      disabled={regeneratingCodes || regenerateCode.length !== 6}
                      className="flex-1 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {regeneratingCodes ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        t('settings.regenerate', '重新生成')
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* New Recovery Codes Modal */}
            {showRecoveryCodes && newRecoveryCodes && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <div className="text-center mb-4">
                    <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                    <h3 className="text-lg font-bold text-gray-800">
                      {t('settings.newRecoveryCodes', '新的恢复码')}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('settings.saveNewCodes', '请安全保存这些恢复码，旧的恢复码已失效')}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      {newRecoveryCodes.map((code, index) => (
                        <code key={index} className="bg-white px-3 py-2 rounded text-gray-700 font-mono text-sm text-center">
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowRecoveryCodes(false);
                      setNewRecoveryCodes(null);
                    }}
                    className="w-full py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition"
                  >
                    {t('common.close', '关闭')}
                  </button>
                </div>
              </div>
            )}

            {/* Trusted Devices */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  {t('settings.trustedDevices', '受信任的设备')}
                </h3>
                {trustedDevices.length > 0 && (
                  <button
                    onClick={handleRevokeAllDevices}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    {t('settings.revokeAll', '撤销全部')}
                  </button>
                )}
              </div>
              {trustedDevices.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">
                  {t('settings.noTrustedDevices', '暂无受信任的设备')}
                </p>
              ) : (
                <div className="space-y-2">
                  {trustedDevices.map(device => (
                    <div key={device.id} className="bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-700">
                          {device.deviceName || t('settings.unknownDevice', '未知设备')}
                        </div>
                        <div className="text-xs text-gray-400 flex items-center gap-2">
                          <Globe className="w-3 h-3" />
                          {device.ip}
                          <span>•</span>
                          {t('settings.expiresAt', '过期')}: {new Date(device.expiresAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevokeDevice(device.id)}
                        disabled={revokingDevice === device.id}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        {revokingDevice === device.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Disable 2FA */}
            {!(twoFAStatus.requiredByAdmin || twoFAStatus.requiredBySystem) && (
              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={() => setShowDisableConfirm(true)}
                  className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                >
                  <ShieldOff className="w-4 h-4" />
                  {t('settings.disable2FA', '禁用两步验证')}
                </button>
              </div>
            )}
            {(twoFAStatus.requiredByAdmin || twoFAStatus.requiredBySystem) && (
              <div className="pt-4 border-t border-gray-100">
                <p className="text-sm text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {t('settings.twoFactorRequired', '您的账户要求启用两步验证，无法禁用')}
                </p>
                {currentUser?.role === 'superadmin' && (
                  <div className="mt-3">
                    <button
                      onClick={handleSuperadminResetSelf}
                      disabled={resettingSelf}
                      className="text-sm text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      {resettingSelf ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      {t('settings.superResetSelf2FA', '超级管理员重置当前账号的 2FA')}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Disable Confirmation Modal */}
            {showDisableConfirm && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
                  <div className="text-center mb-4">
                    <ShieldOff className="w-12 h-12 text-red-500 mx-auto mb-2" />
                    <h3 className="text-lg font-bold text-gray-800">
                      {t('settings.confirmDisable2FA', '确认禁用两步验证')}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {t('settings.disableWarning', '禁用后，您的账户安全性将降低。请输入验证码确认操作。')}
                    </p>
                  </div>
                  <input
                    type="text"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-center text-xl tracking-widest font-mono mb-4"
                    autoFocus
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDisableConfirm(false);
                        setDisableCode('');
                      }}
                      className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition"
                    >
                      {t('common.cancel', '取消')}
                    </button>
                    <button
                      onClick={handleDisable2FA}
                      disabled={disabling2FA || disableCode.length !== 6}
                      className="flex-1 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {disabling2FA ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        t('settings.disable', '禁用')
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recommendation to enable */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{t('settings.recommendEnable', '建议启用两步验证')}</p>
                <p className="mt-1">{t('settings.recommendEnableDesc', '两步验证可以大大提高您账户的安全性，防止未授权访问。')}</p>
              </div>
            </div>

            {setupError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {setupError}
              </div>
            )}

            {/* For existing 2FA, require current code to rotate secret */}
            {twoFAStatus?.enabled && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {t('settings.current2FACode', '请输入当前 2FA 验证码以更新绑定')}
                </label>
                <input
                  type="text"
                  value={setupCurrentCode}
                  onChange={(e) => setSetupCurrentCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none text-center text-lg tracking-widest font-mono"
                />
              </div>
            )}

            <button
              onClick={handleStart2FASetup}
              disabled={setupLoading || (twoFAStatus?.enabled && setupCurrentCode.length !== 6)}
              className="w-full py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {setupLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  {t('settings.enable2FA', '启用两步验证')}
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 2FA Setup Modal */}
      {showSetup && setupData && (
        <TwoFactorSetup
          qrCode={setupData.qrCode}
          secret={setupData.secret}
          onVerify={handleVerify2FA}
          onCancel={handleSetupComplete}
        />
      )}

      {/* Password Change Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-gray-100">
            <Lock className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {t('settings.changePassword', '修改密码')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('settings.changePasswordDesc', '定期修改密码以保护账户安全')}
            </p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.currentPassword', '当前密码')}
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.newPassword', '新密码')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {t('settings.passwordRequirement', '密码长度至少8位')}
            </p>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('settings.confirmPassword', '确认新密码')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          {/* Error/Success Messages */}
          {passwordError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              {t('settings.passwordChanged', '密码修改成功')}
            </div>
          )}

          <button
            type="submit"
            disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="w-full py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {changingPassword ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              t('settings.updatePassword', '更新密码')
            )}
          </button>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
        <p>{t('settings.loggedInAs', '当前登录')}: <span className="font-medium text-gray-700">{currentUser?.username}</span></p>
        <p>{t('settings.role', '角色')}: <span className="font-medium text-gray-700">{currentUser?.role}</span></p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { KeyRound, ShieldCheck, Smartphone, Loader2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TwoFactorVerifyProps {
  onVerify: (code: string, trustDevice: boolean, deviceName: string) => Promise<boolean>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

export const TwoFactorVerify: React.FC<TwoFactorVerifyProps> = ({
  onVerify,
  onCancel,
  loading = false,
  error,
}) => {
  const { t } = useTranslation('admin');
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    await onVerify(code.trim(), trustDevice, deviceName.trim());
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, useRecoveryCode ? 8 : 6);
    setCode(value);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-500/20 mb-4">
              <ShieldCheck className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {t('twoFactor.verifyTitle', '两步验证')}
            </h2>
            <p className="text-gray-400 text-sm">
              {useRecoveryCode
                ? t('twoFactor.enterRecoveryCode', '请输入您的恢复码')
                : t('twoFactor.enterCode', '请输入身份验证器应用中的6位验证码')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {useRecoveryCode
                  ? t('twoFactor.recoveryCode', '恢复码')
                  : t('twoFactor.verificationCode', '验证码')}
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder={useRecoveryCode ? 'XXXXXXXX' : '000000'}
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                  autoFocus
                  autoComplete="one-time-code"
                  disabled={loading}
                />
              </div>
            </div>

            {!useRecoveryCode && (
              <div className="space-y-4">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={trustDevice}
                    onChange={(e) => setTrustDevice(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-600 text-purple-500 focus:ring-purple-500 bg-white/5"
                  />
                  <span className="text-sm text-gray-300 flex items-center">
                    <Smartphone className="w-4 h-4 mr-1" />
                    {t('twoFactor.trustDevice', '信任此设备（7天内免输验证码）')}
                  </span>
                </label>

                {trustDevice && (
                  <input
                    type="text"
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder={t('twoFactor.deviceNamePlaceholder', '设备名称（可选）')}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                  />
                )}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || code.length < (useRecoveryCode ? 8 : 6)}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                t('twoFactor.verify', '验证')
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col space-y-3">
            <button
              type="button"
              onClick={() => {
                setUseRecoveryCode(!useRecoveryCode);
                setCode('');
                // Reset trust device state when switching modes
                setTrustDevice(false);
                setDeviceName('');
              }}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              {useRecoveryCode
                ? t('twoFactor.useAuthenticator', '使用身份验证器')
                : t('twoFactor.useRecoveryCode', '使用恢复码')}
            </button>

            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-400 hover:text-gray-300 transition-colors flex items-center justify-center"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {t('twoFactor.backToLogin', '返回登录')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorVerify;

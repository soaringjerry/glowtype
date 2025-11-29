import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useAdminAuth } from './hooks/useAdmin';
import { TwoFactorVerify } from './components/TwoFactorVerify';

interface AdminLoginProps {
  onLogin: () => void;
}

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const { t } = useTranslation('admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login, loading, error, lockUntil, requiresTwoFA, authenticate2FA, cancel2FA } = useAdminAuth();
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [twoFALoading, setTwoFALoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(username, password);
    if (success) {
      onLogin();
    }
  };

  const handleTwoFAVerify = async (code: string, trustDevice: boolean, deviceName: string): Promise<boolean> => {
    setTwoFALoading(true);
    setTwoFAError(null);
    try {
      const success = await authenticate2FA(code, trustDevice, deviceName);
      if (success) {
        onLogin();
        return true;
      }
      setTwoFAError(t('twoFactor.verifyFailed', '验证码错误，请重试'));
      return false;
    } catch {
      setTwoFAError(t('twoFactor.verifyError', '验证失败，请重试'));
      return false;
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleCancelTwoFA = () => {
    cancel2FA();
    setTwoFAError(null);
  };

  // Show 2FA verification screen if needed
  if (requiresTwoFA) {
    return (
      <TwoFactorVerify
        onVerify={handleTwoFAVerify}
        onCancel={handleCancelTwoFA}
        loading={twoFALoading}
        error={twoFAError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{t('login.title')}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('login.username')}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('login.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
            />
          </div>

          {(error || lockUntil) && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" />
              <div className="flex flex-col">
                {error && <span>{error}</span>}
                {lockUntil && (
                  <span className="text-xs text-red-400">
                    {t('login.locked', { time: new Date(lockUntil).toLocaleString() })}
                  </span>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password || !username}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('common.loading')}
              </>
            ) : (
              t('login.submit')
            )}
          </button>
        </form>

        <p className="text-center text-gray-400 text-sm mt-6">
          {t('title')}
        </p>
      </div>
    </div>
  );
}

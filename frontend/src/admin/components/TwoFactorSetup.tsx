import { useState } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Loader2,
  QrCode,
  AlertTriangle,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface TwoFactorSetupProps {
  qrCode: string;
  secret: string;
  onVerify: (code: string) => Promise<{ success: boolean; recoveryCodes?: string[] }>;
  onCancel: () => void;
  loading?: boolean;
  error?: string | null;
}

type SetupStep = 'scan' | 'verify' | 'recovery';

export const TwoFactorSetup: React.FC<TwoFactorSetupProps> = ({
  qrCode,
  secret,
  onVerify,
  onCancel,
  loading = false,
  error,
}) => {
  const { t } = useTranslation('admin');
  const [step, setStep] = useState<SetupStep>('scan');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCopyCodes = async () => {
    try {
      const codesText = recoveryCodes.join('\n');
      await navigator.clipboard.writeText(codesText);
      setCopiedCodes(true);
      setTimeout(() => setCopiedCodes(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(value);
    setVerifyError(null);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.length !== 6) return;

    setVerifying(true);
    setVerifyError(null);

    try {
      const result = await onVerify(code.trim());
      if (result.success && result.recoveryCodes) {
        setRecoveryCodes(result.recoveryCodes);
        setStep('recovery');
      } else {
        setVerifyError(t('twoFactor.verifyFailed', '验证码错误，请重试'));
      }
    } catch {
      setVerifyError(t('twoFactor.verifyError', '验证失败，请重试'));
    } finally {
      setVerifying(false);
    }
  };

  const handleComplete = () => {
    onCancel(); // Close the dialog - 2FA is already enabled
  };

  // Step 1: Scan QR Code
  if (step === 'scan') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center">
              <ShieldCheck className="w-6 h-6 mr-2 text-purple-400" />
              {t('twoFactor.setupTitle', '设置两步验证')}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="text-center">
              <p className="text-gray-300 text-sm mb-4">
                {t('twoFactor.scanQRCode', '使用身份验证器应用扫描下方二维码')}
              </p>
              <div className="bg-white p-4 rounded-xl inline-block">
                <img
                  src={qrCode}
                  alt="2FA QR Code"
                  className="w-48 h-48"
                />
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-gray-400 text-xs mb-2 flex items-center">
                <QrCode className="w-4 h-4 mr-1" />
                {t('twoFactor.manualEntry', '或手动输入密钥：')}
              </p>
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-slate-900 px-3 py-2 rounded-lg text-purple-400 font-mono text-sm break-all">
                  {secret}
                </code>
                <button
                  onClick={handleCopySecret}
                  className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-gray-300 transition-colors"
                  title={t('twoFactor.copySecret', '复制密钥')}
                >
                  {copiedSecret ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-300 text-xs flex items-start">
                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                {t('twoFactor.setupWarning', '请确保您已在身份验证器应用中添加此账户，再点击下一步')}
              </p>
            </div>

            <button
              onClick={() => setStep('verify')}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
            >
              {t('twoFactor.next', '下一步')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Verify Code
  if (step === 'verify') {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center">
              <KeyRound className="w-6 h-6 mr-2 text-purple-400" />
              {t('twoFactor.verifySetup', '验证设置')}
            </h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <p className="text-gray-300 text-sm mb-4">
                {t('twoFactor.enterSetupCode', '请输入身份验证器应用中显示的6位验证码以完成设置')}
              </p>
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                placeholder="000000"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-2xl tracking-widest font-mono"
                autoFocus
                autoComplete="one-time-code"
                disabled={verifying}
              />
            </div>

            {(verifyError || error) && (
              <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
                {verifyError || error}
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep('scan')}
                className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
              >
                {t('twoFactor.back', '返回')}
              </button>
              <button
                type="submit"
                disabled={verifying || loading || code.length !== 6}
                className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center"
              >
                {verifying || loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  t('twoFactor.verify', '验证')
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Step 3: Show Recovery Codes
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-700">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {t('twoFactor.setupComplete', '两步验证已启用')}
          </h2>
        </div>

        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-amber-400 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-amber-300 text-sm font-medium mb-1">
                  {t('twoFactor.saveRecoveryCodes', '请保存以下恢复码')}
                </p>
                <p className="text-amber-300/70 text-xs">
                  {t('twoFactor.recoveryCodesWarning', '如果您丢失了身份验证器访问权限，可以使用恢复码登录。每个恢复码只能使用一次。')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">
                {t('twoFactor.recoveryCodes', '恢复码')}
              </span>
              <button
                onClick={handleCopyCodes}
                className="flex items-center text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                {copiedCodes ? (
                  <>
                    <Check className="w-4 h-4 mr-1" />
                    {t('twoFactor.copied', '已复制')}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    {t('twoFactor.copy', '复制')}
                  </>
                )}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {recoveryCodes.map((code, index) => (
                <code
                  key={index}
                  className="bg-slate-800 px-3 py-2 rounded text-gray-300 font-mono text-sm text-center"
                >
                  {code}
                </code>
              ))}
            </div>
          </div>

          <button
            onClick={handleComplete}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            {t('twoFactor.done', '完成')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;

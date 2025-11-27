import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function Footer() {
  const { t, i18n } = useTranslation('common');
  const isZh = i18n.language.startsWith('zh');

  return (
    <footer className="border-t border-slate-200 bg-white/80">
      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Main footer content */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-slate-500">
              &copy; {new Date().getFullYear()} Glowtype.me
            </p>
            <p className="text-[11px] text-slate-400">
              {isZh ? '情绪探索，而非诊断' : 'Emotional exploration, not diagnosis'}
            </p>
          </div>

          {/* Legal links */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <Link
              to="/terms"
              className="text-slate-500 transition hover:text-slate-700"
            >
              {isZh ? '用户条款' : 'Terms'}
            </Link>
            <Link
              to="/privacy"
              className="text-slate-500 transition hover:text-slate-700"
            >
              {isZh ? '隐私政策' : 'Privacy'}
            </Link>
            <Link
              to="/safety"
              className="text-slate-500 transition hover:text-slate-700"
            >
              {t('nav.safety')}
            </Link>
            <Link
              to="/help"
              className="text-sky-500 transition hover:text-sky-600"
            >
              {t('nav.help')}
            </Link>
          </div>
        </div>

        {/* Crisis notice */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-center text-[11px] text-slate-400">
            {t('safetyNoticeShort')}
          </p>
        </div>
      </div>
    </footer>
  );
}

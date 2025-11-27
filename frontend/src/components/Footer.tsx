import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function Footer() {
  const { t } = useTranslation('common');

  return (
    <footer className="border-t border-slate-200 bg-white/80">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Glowtype.me</p>
        <p>
          {t('safetyNoticeShort')}{' '}
          <Link to="/help" className="text-sky-500 hover:text-sky-600">
            {t('nav.help')}
          </Link>
        </p>
      </div>
    </footer>
  );
}

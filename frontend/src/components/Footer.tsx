import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function Footer() {
  const { t } = useTranslation('common');

  return (
    <footer className="border-t border-slate-800 bg-slate-950/90">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Glowtype.me</p>
        <p>
          {t('safetyNoticeShort')}{' '}
          <Link to="/help" className="text-sky-300 hover:text-sky-200">
            {t('nav.help')}
          </Link>
        </p>
      </div>
    </footer>
  );
}


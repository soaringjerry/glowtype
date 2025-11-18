import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Link, NavLink } from 'react-router-dom';

export function Navbar() {
  const { t } = useTranslation('common');

  const currentLang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';

  const switchLang = (lang: 'en' | 'zh-CN') => {
    void i18n.changeLanguage(lang);
    window.localStorage.setItem('glowtype-lang', lang);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm ${
      isActive ? 'text-slate-900' : 'text-slate-500 hover:text-slate-900'
    }`;

  return (
    <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-900">{t('siteName')}</span>
        </Link>
        <nav className="flex items-center gap-4">
          <NavLink to="/" className={navLinkClass}>
            {t('nav.home')}
          </NavLink>
          <NavLink to="/quiz" className={navLinkClass}>
            {t('nav.quiz')}
          </NavLink>
          <NavLink to="/chat" className={navLinkClass}>
            {t('nav.chat')}
          </NavLink>
          <NavLink to="/help" className={navLinkClass}>
            {t('nav.help')}
          </NavLink>
          <NavLink to="/safety" className={navLinkClass}>
            {t('nav.safety')}
          </NavLink>
          <div className="ml-2 flex items-center gap-1 rounded-full bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => switchLang('en')}
              className={`px-2 py-1 rounded-full ${
                currentLang === 'en' ? 'bg-slate-900 text-slate-50' : 'text-slate-600'
              }`}
            >
              {t('language.en')}
            </button>
            <button
              type="button"
              onClick={() => switchLang('zh-CN')}
              className={`px-2 py-1 rounded-full ${
                currentLang === 'zh-CN' ? 'bg-slate-900 text-slate-50' : 'text-slate-600'
              }`}
            >
              {t('language.zh')}
            </button>
          </div>
        </nav>
      </div>
    </header>
  );
}

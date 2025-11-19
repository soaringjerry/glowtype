import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export function Navbar() {
  const { t } = useTranslation('common');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const currentLang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';

  const switchLang = (lang: 'en' | 'zh-CN') => {
    void i18n.changeLanguage(lang);
    window.localStorage.setItem('glowtype-lang', lang);
    setIsMenuOpen(false);
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'relative px-3 py-2 text-sm transition-colors',
      isActive
        ? 'text-slate-900 font-medium'
        : 'text-slate-500 hover:text-slate-900',
    ].join(' ');

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'block px-4 py-3 text-base transition-colors border-l-2',
      isActive
        ? 'border-sky-400 bg-sky-50/50 text-sky-900 font-medium'
        : 'border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900',
    ].join(' ');

  const siteName = t('siteName');
  const [brandMain, brandSuffixRaw] = siteName.split('.');
  const brandSuffix = brandSuffixRaw ? `.${brandSuffixRaw}` : '';

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2" onClick={() => setIsMenuOpen(false)}>
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-sky-400/90 to-fuchsia-400/90 shadow-[0_0_14px_rgba(56,189,248,0.45)]" />
          <div className="flex items-baseline gap-1 leading-tight">
            <span className="text-[15px] font-semibold tracking-tight text-slate-900">
              {brandMain}
            </span>
            {brandSuffix && (
              <span className="rounded-full border border-slate-200/70 bg-slate-50 px-1.5 py-[1px] text-[10px] font-medium text-slate-500">
                {brandSuffix}
              </span>
            )}
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-4 md:flex">
          <div className="flex items-center gap-1 rounded-full bg-slate-100/80 px-1 py-0.5 text-xs text-slate-600">
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
          </div>
          <div className="ml-2 flex items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              onClick={() => switchLang('en')}
              className={`transition-colors ${currentLang === 'en'
                  ? 'font-semibold text-slate-900'
                  : 'hover:text-slate-700'
                }`}
            >
              {t('language.en')}
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => switchLang('zh-CN')}
              className={`transition-colors ${currentLang === 'zh-CN'
                  ? 'font-semibold text-slate-900'
                  : 'hover:text-slate-700'
                }`}
            >
              {t('language.zh')}
            </button>
          </div>
        </nav>

        {/* Mobile Menu Button */}
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-95 md:hidden"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Navigation Dropdown */}
      {isMenuOpen && (
        <div className="absolute left-0 right-0 top-full border-b border-slate-100 bg-white/95 backdrop-blur-xl md:hidden">
          <nav className="flex flex-col py-2">
            <NavLink to="/" className={mobileNavLinkClass} onClick={() => setIsMenuOpen(false)}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/quiz" className={mobileNavLinkClass} onClick={() => setIsMenuOpen(false)}>
              {t('nav.quiz')}
            </NavLink>
            <NavLink to="/chat" className={mobileNavLinkClass} onClick={() => setIsMenuOpen(false)}>
              {t('nav.chat')}
            </NavLink>
            <NavLink to="/help" className={mobileNavLinkClass} onClick={() => setIsMenuOpen(false)}>
              {t('nav.help')}
            </NavLink>
            <NavLink to="/safety" className={mobileNavLinkClass} onClick={() => setIsMenuOpen(false)}>
              {t('nav.safety')}
            </NavLink>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <span className="text-sm text-slate-500">Language / 语言</span>
              <div className="flex items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => switchLang('en')}
                  className={`rounded-md px-2 py-1 transition-colors ${currentLang === 'en'
                      ? 'bg-slate-100 font-semibold text-slate-900'
                      : 'text-slate-500'
                    }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => switchLang('zh-CN')}
                  className={`rounded-md px-2 py-1 transition-colors ${currentLang === 'zh-CN'
                      ? 'bg-slate-100 font-semibold text-slate-900'
                      : 'text-slate-500'
                    }`}
                >
                  中文
                </button>
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GlowtypeCard } from '../components/GlowtypeCard';

export function HomePage() {
  const { t } = useTranslation('home');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16">
      <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-2">
        <div className="hero-planet pointer-events-none" />

        <div className="relative z-10 max-w-xl space-y-4 text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-500">
            ✨ {t('heroBadge')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-700 sm:text-base">
            {t('heroSubtitle')}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/quiz"
              className="rounded-full bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-50 shadow-[0_0_32px_rgba(56,189,248,0.35)] transition hover:bg-sky-400 hover:shadow-[0_0_40px_rgba(125,211,252,0.55)] active:scale-95"
            >
              {t('startQuiz')}
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-10 left-1/2 hidden w-56 -translate-x-1/2 md:block">
          <div className="glow-orbit">
            <GlowtypeCard
              title={t('heroCardTitle')}
              subtitle={t('heroCardSubtitle')}
              className="px-4 py-4 text-center"
            />
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mt-10 space-y-3 text-center"
        aria-label={t('howItWorks')}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
          {t('howItWorks')}
        </p>
        <div className="flex flex-col items-center gap-3 text-sm text-slate-700 md:flex-row md:justify-center">
          <div>
            <span className="mr-1">1️⃣</span>
            {t('step1Title')}
          </div>
          <div className="hidden h-[1px] w-8 bg-slate-200 md:block" />
          <div>
            <span className="mr-1">2️⃣</span>
            {t('step2Title')}
          </div>
          <div className="hidden h-[1px] w-8 bg-slate-200 md:block" />
          <div>
            <span className="mr-1">3️⃣</span>
            {t('step3Title')}
          </div>
        </div>
      </section>

      <section className="mt-8 flex flex-col items-center gap-2 text-xs text-slate-500 md:flex-row md:justify-center">
        <span>🪐 {t('whatItIsTitle')}</span>
        <span className="hidden text-slate-300 md:inline">•</span>
        <span className="md:max-w-md md:text-center">{t('whatItIsBody')}</span>
        <span className="hidden text-slate-300 md:inline">•</span>
        <button
          type="button"
          className="mt-1 text-xs font-medium text-sky-500 underline-offset-4 hover:underline md:mt-0"
        >
          <Link to="/safety">🔐 {t('safetyPreviewTitle')}</Link>
        </button>
      </section>
    </div>
  );
}

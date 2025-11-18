import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function HomePage() {
  const { t } = useTranslation('home');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16">
      <section className="relative flex min-h-[60vh] flex-col-reverse items-center gap-10 md:flex-row md:items-center md:justify-between">
        <div className="pointer-events-none absolute -right-10 top-0 hidden h-40 w-40 rounded-full bg-sky-200/60 blur-3xl md:block" />
        <div className="mt-6 flex w-full justify-center md:mt-0 md:w-auto">
          <div className="glow-orbit relative h-52 w-52 overflow-hidden rounded-[32px] border border-sky-300/70 bg-white/80 shadow-[0_0_40px_rgba(59,130,246,0.35)] backdrop-blur">
            <div className="pointer-events-none absolute -left-8 top-6 h-24 w-24 rounded-full bg-sky-200/60 blur-2xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-full bg-fuchsia-200/50 blur-2xl" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                Glowtype
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {t('heroCardTitle')}
              </p>
              <p className="text-[11px] text-slate-400">
                {t('heroCardSubtitle')}
              </p>
            </div>
          </div>
        </div>
        <div className="max-w-xl space-y-4 text-center md:text-left">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-500">
            ✨ {t('heroBadge')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-700 sm:text-base">
            {t('heroSubtitle')}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 md:justify-start">
            <Link
              to="/quiz"
              className="rounded-full bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-50 shadow-[0_0_32px_rgba(56,189,248,0.35)] transition hover:bg-sky-400 hover:shadow-[0_0_40px_rgba(125,211,252,0.55)] active:scale-95"
            >
              {t('startQuiz')}
            </Link>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mt-10 space-y-4 text-center crayon-text"
        aria-label={t('howItWorks')}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-slate-400">
          {t('howItWorks')}
        </p>
        <div className="how-wave flex flex-col items-center gap-3 text-sm text-slate-700 md:flex-row md:justify-center">
          <div className="how-step-card how-step-card--1">
            <span>1️⃣</span>
            <span className="mt-0.5 leading-snug">{t('step1Title')}</span>
          </div>
          <div className="how-step-card how-step-card--2">
            <span>2️⃣</span>
            <span className="mt-0.5 leading-snug">{t('step2Title')}</span>
          </div>
          <div className="how-step-card how-step-card--3">
            <span>3️⃣</span>
            <span className="mt-0.5 leading-snug">{t('step3Title')}</span>
          </div>
        </div>
      </section>

      <section className="mt-8 flex flex-col items-center gap-3 text-xs text-slate-500 md:flex-row md:justify-center crayon-text">
        <div className="how-safety-chip flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-600">
          <span>🪐 {t('whatItIsTitle')}</span>
          <span className="hidden text-slate-300 md:inline">•</span>
          <span className="md:max-w-md md:text-center">{t('whatItIsBody')}</span>
          <span className="hidden text-slate-300 md:inline">•</span>
          <Link
            to="/safety"
            className="font-medium text-sky-500 underline-offset-4 hover:underline"
          >
            🔐 {t('safetyPreviewTitle')}
          </Link>
        </div>
      </section>
    </div>
  );
}

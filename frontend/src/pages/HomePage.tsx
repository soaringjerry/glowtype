import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function HomePage() {
  const { t } = useTranslation('home');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-16">
      <section className="relative flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
        <div className="pointer-events-none absolute -right-10 top-0 hidden h-40 w-40 rounded-full bg-sky-200/60 blur-3xl md:block" />
        <div className="max-w-xl space-y-4">
          <p className="text-xs uppercase tracking-[0.2em] text-sky-500">
            ✨ {t('heroBadge')}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-1 text-sm text-slate-700 sm:text-base">
            {t('heroSubtitle')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/quiz"
              className="rounded-full bg-sky-500 px-6 py-2.5 text-sm font-medium text-slate-50 shadow-[0_0_32px_rgba(56,189,248,0.35)] transition hover:bg-sky-400 hover:shadow-[0_0_40px_rgba(125,211,252,0.55)] active:scale-95"
            >
              {t('startQuiz')}
            </Link>
            <Link
              to="#how-it-works"
              className="text-sm text-slate-600 underline-offset-4 hover:underline"
            >
              {t('learnGlowtype')}
            </Link>
          </div>
        </div>
        <div className="mt-4 flex w-full justify-center md:mt-0 md:w-auto">
          <div className="glow-orbit relative h-52 w-52 overflow-hidden rounded-[32px] border border-sky-300/70 bg-white/80 shadow-[0_0_40px_rgba(59,130,246,0.35)] backdrop-blur">
            <div className="pointer-events-none absolute -left-8 top-6 h-24 w-24 rounded-full bg-sky-200/60 blur-2xl" />
            <div className="pointer-events-none absolute bottom-0 right-0 h-28 w-28 rounded-full bg-fuchsia-200/50 blur-2xl" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl" aria-hidden="true">
                🌙
              </span>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="grid gap-6 md:grid-cols-3"
        aria-label={t('howItWorks')}
      >
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs text-sky-500">1 · {t('step1Title')}</p>
          <p className="mt-2 text-sm text-slate-700">{t('step1Body')}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs text-sky-500">2 · {t('step2Title')}</p>
          <p className="mt-2 text-sm text-slate-700">{t('step2Body')}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <p className="text-xs text-sky-500">3 · {t('step3Title')}</p>
          <p className="mt-2 text-sm text-slate-700">{t('step3Body')}</p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[2fr,1.4fr]">
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('whatItIsTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-700">{t('whatItIsBody')}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('safetyPreviewTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-700">
            {t('safetyPreviewBody')}
          </p>
          <p className="mt-2 text-xs text-slate-500">{t('safetyPreviewExtra')}</p>
          <Link
            to="/safety"
            className="mt-3 inline-flex text-xs font-medium text-sky-300 underline-offset-4 hover:underline"
          >
            {t('seeSafetyPage')}
          </Link>
        </div>
      </section>
    </div>
  );
}

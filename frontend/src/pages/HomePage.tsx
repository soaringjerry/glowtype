import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export function HomePage() {
  const { t } = useTranslation('home');

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-8">
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-xl">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t('heroTitle')}
          </h1>
          <p className="mt-3 text-sm text-slate-300 sm:text-base">
            {t('heroSubtitle')}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              to="/quiz"
              className="rounded-full bg-sky-400 px-5 py-2 text-sm font-medium text-slate-900 hover:bg-sky-300"
            >
              {t('startQuiz')}
            </Link>
            <Link
              to="#how-it-works"
              className="text-sm text-slate-300 underline-offset-4 hover:underline"
            >
              {t('howItWorks')}
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-base font-semibold">{t('howItWorks')}</h2>
          <p className="mt-2 text-sm text-slate-300">{t('howItWorksBody')}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-base font-semibold">{t('whatItIsTitle')}</h2>
          <p className="mt-2 text-sm text-slate-300">{t('whatItIsBody')}</p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[2fr,1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <h2 className="text-base font-semibold">{t('safetyPreviewTitle')}</h2>
          <p className="mt-2 text-sm text-slate-300">{t('safetyPreviewBody')}</p>
          <Link
            to="/safety"
            className="mt-3 inline-flex text-sm text-sky-300 underline-offset-4 hover:underline"
          >
            {t('seeSafetyPage')}
          </Link>
        </div>
      </section>
    </div>
  );
}


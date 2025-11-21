import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api/client';
import { ResultCard } from '../components/ResultCard';

type GlowtypeResponse = {
  id: string;
  language: string;
  name: string;
  tagline: string;
  description: string[];
  selfCareTips: string[];
  disclaimer: string;
};

export function ResultPage() {
  const { typeId } = useParams<{ typeId: string }>();
  const { t, i18n } = useTranslation('result');
  const [data, setData] = useState<GlowtypeResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!typeId) return;
    const lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';
    apiGet<GlowtypeResponse>(`/glowtypes/${encodeURIComponent(typeId)}?lang=${lang}`)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true));
  }, [typeId, i18n.language]);

  if (!typeId) {
    return null;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-300">
        Something went wrong. Please try again.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-slate-300">
        Loading...
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-8">
      <h1 className="text-xs uppercase tracking-[0.3em] text-sky-500">
        {t('title')}
      </h1>

      <div className="mt-4 w-full max-w-md">
        <ResultCard
          title={data.name}
          tagline={data.tagline}
        />
      </div>

      <section className="mt-6 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <h2 className="text-sm font-semibold text-slate-900">
          {t('vibeTitle')}
        </h2>
        <div className="mt-2 space-y-2 text-sm text-slate-700">
          {data.description.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
      </section>

      <section className="mt-4 w-full max-w-3xl rounded-3xl border border-slate-200 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
        <h2 className="text-sm font-semibold text-slate-900">
          {t('selfCareTips')}
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {data.selfCareTips.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4 w-full max-w-3xl text-xs text-slate-500">
        <p>{t('disclaimer')}</p>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
        <Link
          to="/chat"
          className="rounded-full bg-sky-500 px-4 py-2 text-slate-50 shadow-[0_0_24px_rgba(56,189,248,0.35)] transition hover:bg-sky-400 hover:shadow-[0_0_32px_rgba(125,211,252,0.55)] active:scale-95"
        >
          {t('chatAboutThis')}
        </Link>
        <Link
          to="/help"
          className="rounded-full border border-slate-300 px-4 py-2 text-slate-800 transition hover:border-sky-300 active:scale-95"
        >
          {t('helpAndHotlines')}
        </Link>
      </div>
    </div>
  );
}

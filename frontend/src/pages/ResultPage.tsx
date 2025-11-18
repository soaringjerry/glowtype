import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api/client';

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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold">
        {t('title')}: {data.name}
      </h1>
      <p className="mt-2 text-sm text-slate-300">{data.tagline}</p>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold">{t('tagline')}</h2>
        <div className="mt-2 space-y-2 text-sm text-slate-300">
          {data.description.map((line, idx) => (
            <p key={idx}>{line}</p>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-sm font-semibold">{t('selfCareTips')}</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
          {data.selfCareTips.map((tip, idx) => (
            <li key={idx}>{tip}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4 text-xs text-slate-400">
        <p>{data.disclaimer}</p>
      </section>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <Link
          to="/chat"
          className="rounded-full bg-sky-400 px-4 py-2 text-slate-900 hover:bg-sky-300"
        >
          {t('chatAboutThis')}
        </Link>
        <Link
          to="/help"
          className="rounded-full border border-slate-700 px-4 py-2 text-slate-100"
        >
          {t('helpAndHotlines')}
        </Link>
      </div>
    </div>
  );
}


import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiGet } from '../api/client';

type Hotline = {
  name: string;
  phone: string;
  website: string;
  note: string;
};

type HelpResponse = {
  language: string;
  crisisDisclaimer: string;
  hotlines: Hotline[];
};

export function HelpPage() {
  const { t, i18n } = useTranslation('help');
  const [data, setData] = useState<HelpResponse | null>(null);

  useEffect(() => {
    const lang = i18n.language.startsWith('zh') ? 'zh-CN' : 'en';
    apiGet<HelpResponse>(`/help?lang=${encodeURIComponent(lang)}`).then((res) => {
      setData(res);
    });
  }, [i18n.language]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold text-slate-950">{t('title')}</h1>
      <p className="mt-2 text-sm text-slate-700">{t('intro')}</p>

      {data && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-slate-800">{data.crisisDisclaimer}</p>
          <ul className="space-y-3 text-sm text-slate-800">
            {data.hotlines.map((h) => (
              <li
                key={h.name}
                className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-[0_18px_45px_rgba(15,23,42,0.05)]"
              >
                <p className="font-medium">{h.name}</p>
                <p className="mt-1 text-slate-700">{h.phone}</p>
                <p className="mt-1 text-slate-500">{h.note}</p>
                {h.website && (
                  <a
                    href={h.website}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs text-sky-300 underline-offset-4 hover:underline"
                  >
                    {t('visitWebsite')}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

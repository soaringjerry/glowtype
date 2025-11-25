import { useMemo } from 'react';
import { GlowtypeCard } from '../components/GlowtypeCard';
import { Zap, ScanLine, Fingerprint } from 'lucide-react';

type ShareCardPayload = {
  data: {
    title: Record<string, string>;
    tagline: Record<string, string>;
    description: Record<string, string>;
    auraGradient: string;
    cardAccent: string;
    textColor: string;
  };
  insight: string | null;
  lang: 'en' | 'zh';
};

function decodePayload(): ShareCardPayload | null {
  try {
    const search = new URLSearchParams(window.location.search);
    const payload = search.get('payload');
    if (!payload) return null;
    const json = atob(payload);
    return JSON.parse(json) as ShareCardPayload;
  } catch (e) {
    console.error('Failed to decode share render payload', e);
    return null;
  }
}

export default function ShareRenderPage() {
  const payload = decodePayload();
  if (!payload) {
    return <div style={{ width: 1080, height: 1920, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#f8fafc' }}>Invalid payload</div>;
  }

  const lang = payload.lang || 'en';
  const data = {
    title: payload.data.title[lang] || payload.data.title.en || '',
    tagline: payload.data.tagline[lang] || payload.data.tagline.en || '',
    description: payload.data.description[lang] || payload.data.description.en || '',
    auraGradient: payload.data.auraGradient,
    cardAccent: payload.data.cardAccent,
    textColor: payload.data.textColor,
  };

  const dateStr = useMemo(
    () =>
      new Date()
        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        .toUpperCase(),
    [],
  );

  const auraId = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < data.title.length; i++) {
      hash = data.title.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash % 900) + 100;
  }, [data.title]);

  return (
    <div
      id="share-card-render"
      className="relative w-[1080px] h-[1920px] overflow-hidden bg-slate-50 flex flex-col items-center justify-between py-28 font-sans"
      style={{ margin: 0, padding: 0 }}
    >
      <div className="absolute inset-0 bg-[#fafafa]" />
      <div
        className="absolute inset-0"
        style={{ backgroundImage: 'radial-gradient(#00000010 1px, transparent 1px)', backgroundSize: '42px 42px' }}
      />
      <div
        className="absolute -top-[10%] left-0 w-[100%] h-[50%] opacity-55 blur-[170px]"
        style={{ background: 'radial-gradient(circle at 40% 30%, rgba(176,144,255,0.9), rgba(124,77,255,0.6), transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-[80%] h-[40%] opacity-45 blur-[150px]"
        style={{ background: 'radial-gradient(circle at 65% 70%, rgba(255,205,255,0.65), rgba(160,120,255,0.45), transparent 75%)' }}
      />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.7),transparent_50%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.55),transparent_55%)]" />
      </div>
      <div className="absolute top-12 left-12 w-6 h-6 border-t-[1.5px] border-l-[1.5px] border-slate-300/60" />
      <div className="absolute top-12 right-12 w-6 h-6 border-t-[1.5px] border-r-[1.5px] border-slate-300/60" />
      <div className="absolute bottom-12 left-12 w-6 h-6 border-b-[1.5px] border-l-[1.5px] border-slate-300/60" />
      <div className="absolute bottom-12 right-12 w-6 h-6 border-b-[1.5px] border-r-[1.5px] border-slate-300/60" />

      <div className="relative z-10 w-full px-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-2xl shadow-lg shadow-slate-900/20">
            <Zap size={24} fill="currentColor" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">GLOWTYPE</span>
            <span className="text-[11px] text-slate-400 font-mono tracking-[0.25em] uppercase mt-1">Analysis Report</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono text-slate-400 tracking-widest">{dateStr}</div>
        </div>
      </div>

      <div className="relative z-10 w-[920px] aspect-[3/5] group">
        <div
          className="absolute inset-0 rounded-[48px] translate-x-5 translate-y-5 opacity-40"
          style={{ backgroundColor: data.cardAccent }}
        />
        <div className="absolute -inset-5 border border-slate-900/5 rounded-[64px]" />
        <div className="relative w-full h-full rounded-[48px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] bg-white">
          <GlowtypeCard
            data={data}
            insight={payload.insight}
            lang={lang}
            animated={false}
            className="w-full h-full"
          />
        </div>
        <div className="absolute -top-6 -right-6 bg-white px-6 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-full border border-slate-100 transform rotate-6 flex items-center gap-3 z-20">
          <ScanLine size={20} className="text-slate-400" />
          <span className="text-lg font-bold tracking-widest text-slate-800 font-mono">#{auraId}</span>
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full px-20">
        <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
        <div className="flex items-end justify-between w-full opacity-60">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-mono text-slate-400 tracking-[0.4em] uppercase">Generated by AI</span>
            <span className="text-xl font-bold text-slate-800 tracking-[0.15em]">GLOWTYPE.ME</span>
          </div>
          <Fingerprint size={40} className="text-slate-300" strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

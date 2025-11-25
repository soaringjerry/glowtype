import { Zap, Fingerprint } from 'lucide-react';

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

  return (
    <div
      id="share-card-render"
      className="relative w-[1080px] h-[1920px] overflow-hidden font-sans"
      style={{
        background: `linear-gradient(145deg, #fef3ff 0%, #ffffff 50%, #f0e6ff 100%)`,
        margin: 0,
        padding: 0,
      }}
    >
      {/* Background glow effects - using blur for Playwright */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] opacity-70 blur-[100px]"
        style={{ background: data.auraGradient }}
      />
      <div
        className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] opacity-50 blur-[80px]"
        style={{ background: 'radial-gradient(circle, rgba(196,181,253,0.8), transparent 70%)' }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }}
      />

      {/* Header */}
      <div className="relative z-10 pt-16 px-16 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center rounded-2xl shadow-xl">
            <Zap size={32} fill="currentColor" />
          </div>
          <div>
            <span className="text-3xl font-black text-slate-900 tracking-tight">GLOWTYPE</span>
            <div className="text-sm text-slate-400 font-medium tracking-wider mt-1">情绪光谱分析</div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-16 py-12">
        {/* Aura ball */}
        <div className="relative w-[420px] h-[420px] mb-16">
          <div
            className="absolute inset-0 rounded-full blur-[60px] opacity-90"
            style={{ background: data.auraGradient }}
          />
          <div
            className="absolute inset-[10%] rounded-full blur-[40px] opacity-70"
            style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.8), rgba(196,181,253,0.4))' }}
          />
          {/* Inner highlight */}
          <div
            className="absolute inset-[25%] rounded-full opacity-60"
            style={{
              background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), transparent 60%)',
            }}
          />
        </div>

        {/* Title */}
        <h1 className={`text-7xl font-serif font-bold text-center mb-6 ${data.textColor}`}>
          {data.title}
        </h1>

        {/* Tagline */}
        <p className="text-2xl text-slate-500 font-medium tracking-wide text-center mb-12 uppercase">
          {data.tagline}
        </p>

        {/* Divider */}
        <div className="w-32 h-1 bg-gradient-to-r from-violet-300 via-purple-400 to-violet-300 rounded-full mb-12" />

        {/* Description or Insight */}
        <div className="max-w-[800px] text-center">
          {payload.insight ? (
            <p className="text-3xl leading-relaxed text-violet-600 font-medium italic">
              "{payload.insight}"
            </p>
          ) : (
            <p className="text-2xl leading-relaxed text-slate-600">
              {data.description}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 pb-16 px-16">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg text-slate-400 font-mono tracking-wider mb-1">
              {lang === 'zh' ? '扫码探索你的光谱' : 'Discover your spectrum'}
            </div>
            <div className="text-2xl font-bold text-slate-700 tracking-wide">
              GLOWTYPE.ME
            </div>
          </div>
          <div className="flex items-center gap-4 bg-white/60 px-6 py-4 rounded-2xl">
            <Fingerprint size={48} className="text-violet-400" strokeWidth={1.5} />
            <div className="text-right">
              <div className="text-sm text-slate-400 font-mono">{lang === 'zh' ? 'AI 生成' : 'AI Generated'}</div>
              <div className="text-lg font-bold text-slate-600">
                {new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

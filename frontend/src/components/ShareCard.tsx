import { forwardRef } from 'react';
import { Sparkles } from 'lucide-react';
import { GlowtypeCard, type GlowtypeCardData } from './GlowtypeCard';

type ShareCardProps = GlowtypeCardData & {
  insight?: string | null;
  lang: 'en' | 'zh';
};

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCard(
    { title, tagline, description, insight, auraGradient, cardAccent, textColor, lang },
    ref,
  ) {
    const cardData: GlowtypeCardData = {
      title,
      tagline,
      description,
      auraGradient,
      cardAccent,
      textColor,
    };

    return (
      <div
        ref={ref}
        className="relative w-[1080px] h-[1920px] overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #fdf5ff 0%, #f7f9ff 50%, #eef4ff 100%)' }}
      >
        {/* Background noise + pastel glows */}
        <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_10%_20%,rgba(255,255,255,0.6),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.6),transparent_45%)]" />
        <div className="absolute -left-32 -top-24 w-[900px] h-[900px] rounded-full bg-pink-200/35 blur-[140px]" />
        <div className="absolute -right-40 top-40 w-[950px] h-[950px] rounded-full bg-sky-200/35 blur-[150px]" />
        <div className="absolute inset-x-20 top-16 h-28 rounded-[28px] bg-white/70 border border-white/50 backdrop-blur-md shadow-[0_24px_80px_-36px_rgba(15,23,42,0.2)]" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-between px-16 py-20">
          {/* Header */}
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/80 border border-white shadow-sm backdrop-blur">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-md shadow-indigo-400/30">
                <Sparkles className="text-white w-4 h-4" />
              </div>
              <span className="text-lg font-semibold text-slate-800 tracking-tight">
                Glowtype
              </span>
            </div>
            <p className="text-sm uppercase tracking-[0.2em] text-gray-500">
              {lang === 'zh' ? '保存你的结果' : 'Save your result'}
            </p>
          </div>

          {/* Card */}
          <div className="w-full flex justify-center">
            <div className="w-[920px] aspect-[3/5] drop-shadow-[0_25px_70px_rgba(15,23,42,0.18)]">
              <GlowtypeCard
                data={cardData}
                insight={insight}
                lang={lang}
                animated={false}
                className="h-full w-full"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col items-center gap-1 text-gray-500 uppercase tracking-[0.24em] text-xl font-semibold">
            <span>glowtype.me</span>
            <span className="text-xs tracking-[0.22em] text-gray-400">
              {lang === 'zh' ? '保存并分享你的光芒' : 'Save & share your glow'}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

ShareCard.displayName = 'ShareCard';

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
        className="relative w-[1080px] h-[1920px] bg-[#FDFCFE] overflow-hidden"
      >
        {/* Background noise + soft gradients */}
        <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-darken" />
        <div className="absolute -left-6 -top-16 w-[1200px] h-[1200px] bg-indigo-200/28 rounded-full blur-[140px] mix-blend-multiply" />
        <div className="absolute -right-20 -bottom-24 w-[1200px] h-[1200px] bg-pink-200/26 rounded-full blur-[160px] mix-blend-multiply" />

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col items-center justify-between px-16 py-24">
          {/* Header */}
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-xl shadow-indigo-400/20 rotate-3">
                <Sparkles className="text-white w-8 h-8" />
              </div>
              <span className="text-5xl font-bold text-gray-900 tracking-tight">
                Glowtype
              </span>
            </div>
            <div className="px-6 py-2 rounded-full bg-white/80 border border-white shadow-sm uppercase tracking-[0.24em] text-sm text-gray-500">
              {lang === 'zh' ? '保存你的結果卡' : 'Save your glow card'}
            </div>
          </div>

          {/* Card */}
          <div className="w-full flex justify-center">
            <div className="w-[900px] aspect-[3/5]">
              <GlowtypeCard
                data={cardData}
                insight={insight}
                lang={lang}
                animated={false}
                variant="share"
                className="h-full w-full"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col items-center gap-2 text-gray-500 uppercase tracking-[0.28em] text-2xl font-semibold">
            <span>glowtype.me</span>
            <span className="text-sm tracking-[0.24em] text-gray-400">
              {lang === 'zh' ? '保存並分享你的光芒' : 'Save & Share Your Glow'}
            </span>
          </div>
        </div>
      </div>
    );
  },
);

ShareCard.displayName = 'ShareCard';

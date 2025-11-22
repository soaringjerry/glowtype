import { forwardRef } from 'react';
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
        className="relative w-[1080px] h-[1920px] bg-[#FDFCFE] overflow-hidden flex items-center justify-center"
      >
        <div className="absolute inset-0 opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-darken" />
        <div className="absolute -left-10 -top-24 w-[1200px] h-[1200px] bg-indigo-200/35 rounded-full blur-[140px] mix-blend-multiply" />
        <div className="absolute -right-24 -bottom-32 w-[1200px] h-[1200px] bg-pink-200/30 rounded-full blur-[160px] mix-blend-multiply" />
        <div className="relative z-10 flex flex-col items-center gap-12 p-12">
          <GlowtypeCard
            data={cardData}
            insight={insight}
            lang={lang}
            animated={false}
            variant="share"
            className="max-w-[900px] w-full aspect-[3/5]"
          />
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

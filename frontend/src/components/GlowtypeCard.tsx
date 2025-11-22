import { forwardRef, memo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export type GlowtypeCardData = {
  title: string;
  tagline: string;
  description: string;
  auraGradient: string;
  cardAccent: string;
  textColor: string;
};

type GlowtypeCardProps = {
  data: GlowtypeCardData;
  insight?: string | null;
  lang: 'en' | 'zh';
  className?: string;
  animated?: boolean;
  variant?: 'display' | 'share';
};

export const GlowtypeCard = memo(
  forwardRef<HTMLDivElement, GlowtypeCardProps>(function GlowtypeCard(
    { data, insight, lang, className = '', animated = true, variant = 'display' },
    ref,
  ) {
    const { title, tagline, description, auraGradient, cardAccent, textColor } =
      data;

    const isShare = variant === 'share';
    // Unified styling for display/share; only minor container tweaks by variant.
    const titleClasses = 'text-4xl md:text-5xl leading-tight';
    const taglineClasses = 'text-xs md:text-sm uppercase tracking-[0.18em]';
    const bodyClasses = 'text-base md:text-lg leading-relaxed';
    const auraMainSize = 'w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64';
    const auraSecondarySize = 'w-44 h-44 md:w-52 md:h-52 lg:w-60 lg:h-60';
    const borderWidth = 'border-[8px]';
    const paddingClasses = isShare ? 'p-8 md:p-9 lg:p-10' : 'p-7 md:p-8 lg:p-9';
    const radius = 'rounded-[40px]';

    const Container = animated ? motion.div : 'div';
    const AuraMain = animated ? motion.div : 'div';
    const AuraSecondary = animated ? motion.div : 'div';

    return (
      <Container
        ref={ref}
        initial={
          animated ? { rotateY: 180, opacity: 0 } : undefined
        }
        animate={
          animated ? { rotateY: 0, opacity: 1 } : undefined
        }
        transition={animated ? { duration: 1, type: 'spring' } : undefined}
        className={`relative h-full w-full ${radius} overflow-hidden bg-gradient-to-br ${cardAccent} shadow-2xl ${borderWidth} border-white/60 ${className}`}
      >
        <div className="absolute inset-0 opacity-[0.6] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay pointer-events-none" />

        <div className="absolute top-6 left-0 w-full flex justify-center z-20">
          <div className="bg-white/30 backdrop-blur-md border border-white/50 px-3 py-1 rounded-full">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-900">
              {lang === 'zh' ? '稀有原型' : 'Rare Prototype'}
            </span>
          </div>
        </div>

        <div className="absolute top-0 left-0 w-full h-[65%] flex items-center justify-center overflow-hidden">
          <AuraMain
            animate={
              animated ? { scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] } : undefined
            }
            transition={
              animated ? { duration: 6, repeat: Infinity, ease: 'easeInOut' } : undefined
            }
            className={`${auraMainSize} rounded-full blur-[40px] mix-blend-multiply`}
            style={{ background: auraGradient }}
          />
          <AuraSecondary
            animate={
              animated ? { scale: [1.2, 1, 1.2], x: [10, -10, 10] } : undefined
            }
            transition={
              animated ? { duration: 8, repeat: Infinity, ease: 'easeInOut' } : undefined
            }
            className={`absolute ${auraSecondarySize} rounded-full blur-[50px] mix-blend-multiply opacity-60`}
            style={{ background: auraGradient, filter: 'hue-rotate(30deg)' }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(255,255,255,0.1)_50%)] bg-[length:100%_4px] pointer-events-none" />
        </div>

        <div className="absolute bottom-0 left-0 w-full h-[45%] z-10">
          <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-white/70 to-transparent backdrop-blur-[2px]" />
          <div className={`relative z-20 ${paddingClasses} h-full flex flex-col justify-end`}>
            <div className="pt-6">
              <h3 className={`${titleClasses} font-serif ${textColor} mb-2`}>
                {title}
              </h3>
              <p className={`${taglineClasses} text-gray-500 font-bold mb-4`}>
                {tagline}
              </p>
              <style>
                {`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}
              </style>
              <div className={`${isShare ? 'h-36 lg:h-40' : 'h-28 lg:h-32'} overflow-y-auto no-scrollbar pr-1`}>
                {insight ? (
                  <p className={`${bodyClasses} font-medium text-indigo-600 italic`}>
                    ✨ “{insight}”
                  </p>
                ) : (
                  <p className={`${bodyClasses} text-gray-600`}>
                    {description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-between items-end pt-4 opacity-50">
              <span className="text-[9px] md:text-[10px] font-mono text-gray-500">
                GEN-1 // {new Date().getFullYear()}
              </span>
              <Sparkles size={10} className="text-indigo-400" />
            </div>
          </div>
        </div>
      </Container>
    );
  }),
);

GlowtypeCard.displayName = 'GlowtypeCard';

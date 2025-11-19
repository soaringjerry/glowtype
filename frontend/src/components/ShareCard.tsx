import React, { forwardRef } from 'react';
import { Sparkles } from 'lucide-react';

interface ShareCardProps {
    title: string;
    tagline: string;
    description: string;
    insight?: string | null;
    auraGradient: string;
    cardAccent: string;
    textColor: string;
    lang: 'en' | 'zh';
}

export const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(({
    title,
    tagline,
    description,
    insight,
    auraGradient,
    cardAccent,
    textColor,
    lang
}, ref) => {

    const isZh = lang === 'zh' || lang?.startsWith('zh');

    return (
        <div
            ref={ref}
            className="relative w-[1080px] h-[1920px] bg-[#FDFCFE] overflow-hidden flex flex-col items-center text-center"
            style={{ fontFamily: isZh ? '"Noto Serif SC", serif' : 'serif' }}
        >
            {/* Background Noise & Gradient */}
            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-darken" />

            {/* Ambient Orbs (Static for reliable capture) */}
            <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-purple-200/40 rounded-full blur-[120px] mix-blend-multiply" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[800px] bg-blue-200/40 rounded-full blur-[120px] mix-blend-multiply" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-between h-full py-32 px-24">

                {/* Header */}
                <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-xl">
                            <Sparkles className="text-white w-8 h-8" />
                        </div>
                        <span className="text-5xl font-bold text-gray-900 tracking-tight">Glowtype</span>
                    </div>
                    <div className="px-6 py-2 rounded-full bg-white/50 border border-gray-200/50 backdrop-blur-md">
                        <span className="text-2xl font-medium text-gray-500 uppercase tracking-widest">
                            {isZh ? '你的光芒人格' : 'Your Inner Universe'}
                        </span>
                    </div>
                </div>

                {/* Main Card Visual */}
                <div className="relative w-full max-w-[800px] aspect-[3/4.5]">
                    <div className={`relative h-full w-full rounded-[64px] overflow-hidden bg-gradient-to-br ${cardAccent} shadow-2xl border-[12px] border-white/80`}>
                        {/* Card Aura */}
                        <div className="absolute top-0 left-0 w-full h-[60%] flex items-center justify-center overflow-hidden">
                            <div className="w-[500px] h-[500px] rounded-full blur-[80px] mix-blend-multiply opacity-90" style={{ background: auraGradient }} />
                        </div>

                        {/* Card Content */}
                        <div className="absolute bottom-0 left-0 w-full p-16 flex flex-col justify-end h-full">
                            <div className="bg-white/40 backdrop-blur-xl rounded-[48px] p-12 border border-white/50 shadow-lg">
                                <h2 className={`text-7xl font-bold ${textColor} mb-6 leading-tight`}>{title}</h2>
                                <p className="text-2xl uppercase tracking-widest text-gray-600 font-bold mb-10">{tagline}</p>

                                <div className="w-full h-[2px] bg-gray-900/10 mb-10" />

                                {insight ? (
                                    <p className="text-3xl font-medium text-indigo-800 italic leading-relaxed">
                                        "{insight}"
                                    </p>
                                ) : (
                                    <p className="text-3xl text-gray-700 leading-relaxed">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col items-center gap-4">
                    <p className="text-3xl text-gray-400 font-medium tracking-wide">glowtype.app</p>
                    <p className="text-xl text-gray-300 uppercase tracking-widest">Discover yours</p>
                </div>

            </div>
        </div>
    );
});

ShareCard.displayName = 'ShareCard';

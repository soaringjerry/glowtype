import { forwardRef } from 'react';
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
            {/* --- BACKGROUND LAYERS --- */}

            {/* Noise Texture */}
            <div className="absolute inset-0 opacity-[0.04] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-darken z-0" />

            {/* Ambient Gradients (Top & Bottom) */}
            <div className="absolute top-[-10%] left-[-20%] w-[1400px] h-[1400px] bg-gradient-to-br from-indigo-100 via-purple-100 to-transparent rounded-full blur-[150px] mix-blend-multiply opacity-80" />
            <div className="absolute bottom-[-10%] right-[-20%] w-[1400px] h-[1400px] bg-gradient-to-tl from-blue-100 via-pink-100 to-transparent rounded-full blur-[150px] mix-blend-multiply opacity-80" />


            {/* --- CONTENT CONTAINER --- */}
            <div className="relative z-10 w-full h-full flex flex-col items-center justify-between py-24 px-16">

                {/* 1. HEADER */}
                <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-3">
                            <Sparkles className="text-white w-10 h-10" />
                        </div>
                        <span className="text-6xl font-bold text-gray-900 tracking-tight">Glowtype</span>
                    </div>
                    <div className="px-8 py-3 rounded-full bg-white/60 border border-white/80 backdrop-blur-xl shadow-sm">
                        <span className="text-2xl font-medium text-gray-500 uppercase tracking-[0.25em]">
                            {isZh ? '你的光芒人格' : 'YOUR INNER UNIVERSE'}
                        </span>
                    </div>
                </div>

                {/* 2. MAIN CARD (Floating) */}
                <div className="relative w-full max-w-[880px] flex-grow flex items-center justify-center">

                    {/* The Card Itself */}
                    <div className={`relative w-full aspect-[3/4.5] rounded-[64px] overflow-hidden bg-gradient-to-br ${cardAccent} shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] border-[12px] border-white/80`}>

                        {/* Card Aura (Internal) */}
                        <div className="absolute top-[-20%] left-0 w-full h-[80%] flex items-center justify-center overflow-hidden">
                            <div className="w-[800px] h-[800px] rounded-full blur-[120px] mix-blend-multiply opacity-80" style={{ background: auraGradient }} />
                        </div>

                        {/* Card Content (Bottom Aligned) */}
                        <div className="absolute bottom-0 left-0 w-full h-full flex flex-col justify-end p-10 z-20">

                            {/* Glass Panel */}
                            <div className="bg-white/50 backdrop-blur-2xl rounded-[48px] p-10 border border-white/60 shadow-lg">

                                {/* Title & Tagline */}
                                <div className="mb-10">
                                    <h2 className={`text-8xl font-bold ${textColor} mb-4 leading-[1.1] tracking-tight`}>{title}</h2>
                                    <p className="text-3xl uppercase tracking-[0.15em] text-gray-600 font-bold opacity-70">{tagline}</p>
                                </div>

                                {/* Divider */}
                                <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-gray-900/10 to-transparent mb-10" />

                                {/* Description / Insight */}
                                {insight ? (
                                    <div className="relative">
                                        <Sparkles className="absolute -top-8 -left-2 text-indigo-300 w-12 h-12 opacity-80" />
                                        <p className="text-4xl font-medium text-indigo-900 italic leading-relaxed relative z-10">
                                            "{insight}"
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-4xl text-gray-800 leading-relaxed font-medium">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. FOOTER */}
                <div className="flex flex-col items-center gap-4 pb-8 opacity-60">
                    <p className="text-3xl text-gray-900 font-medium tracking-wide font-sans">glowtype.app</p>
                    <p className="text-xl text-gray-500 uppercase tracking-[0.3em]">Discover yours</p>
                </div>

            </div>
        </div>
    );
});

ShareCard.displayName = 'ShareCard';

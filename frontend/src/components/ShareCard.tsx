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
            {/* Background Noise & Gradient */}
            <div className="absolute inset-0 opacity-[0.04] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-darken" />
            
            {/* Ethereal Background Elements */}
            <div className="absolute top-[-15%] left-[-20%] w-[1200px] h-[1200px] bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full blur-[150px] mix-blend-multiply" />
            <div className="absolute bottom-[-15%] right-[-20%] w-[1200px] h-[1200px] bg-gradient-to-tl from-blue-200/30 to-pink-200/30 rounded-full blur-[150px] mix-blend-multiply" />

            {/* Content Container */}
            <div className="relative z-10 flex flex-col items-center justify-between h-full py-24 px-16">

                {/* Header */}
                <div className="flex flex-col items-center gap-8">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 rounded-[2rem] bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center shadow-2xl shadow-indigo-500/20 rotate-3">
                            <Sparkles className="text-white w-10 h-10" />
                        </div>
                        <span className="text-6xl font-bold text-gray-900 tracking-tight">Glowtype</span>
                    </div>
                    <div className="px-8 py-3 rounded-full bg-white/60 border border-white/80 backdrop-blur-xl shadow-sm">
                        <span className="text-3xl font-medium text-gray-500 uppercase tracking-[0.2em]">
                            {isZh ? '你的光芒人格' : 'Your Inner Universe'}
                        </span>
                    </div>
                </div>

                {/* Main Card Visual */}
                <div className="relative w-full max-w-[920px] flex-grow flex items-center justify-center py-12">
                    <div className={`relative w-full aspect-[3/4.2] rounded-[80px] overflow-hidden bg-gradient-to-br ${cardAccent} shadow-[0_60px_120px_-20px_rgba(0,0,0,0.15)] border-[16px] border-white/90`}>
                        
                        {/* Card Aura */}
                        <div className="absolute top-0 left-0 w-full h-[70%] flex items-center justify-center overflow-hidden">
                            <div className="w-[700px] h-[700px] rounded-full blur-[100px] mix-blend-multiply opacity-90 animate-pulse" style={{ background: auraGradient }} />
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
                        </div>

                        {/* Card Content */}
                        <div className="absolute bottom-0 left-0 w-full p-10 flex flex-col justify-end h-full z-20">
                            <div className="bg-white/60 backdrop-blur-2xl rounded-[56px] p-10 border border-white/60 shadow-xl">
                                <h2 className={`text-8xl font-bold ${textColor} mb-6 leading-[1.1] tracking-tight`}>{title}</h2>
                                <p className="text-3xl uppercase tracking-[0.15em] text-gray-600 font-bold mb-12 opacity-80">{tagline}</p>

                                <div className="w-full h-[3px] bg-gradient-to-r from-transparent via-gray-900/10 to-transparent mb-12" />

                                {insight ? (
                                    <p className="text-4xl font-medium text-indigo-900 italic leading-relaxed relative">
                                        <span className="absolute -top-8 -left-4 text-6xl text-indigo-200 opacity-50">"</span>
                                        {insight}
                                        <span className="absolute -bottom-12 -right-4 text-6xl text-indigo-200 opacity-50">"</span>
                                    </p>
                                ) : (
                                    <p className="text-4xl text-gray-800 leading-relaxed font-medium">
                                        {description}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col items-center gap-5 pb-8">
                    <p className="text-4xl text-gray-400 font-medium tracking-wide font-sans">glowtype.app</p>
                    <p className="text-2xl text-gray-300 uppercase tracking-[0.3em]">Discover yours</p>
                </div>

            </div>
        </div>
    );
});

ShareCard.displayName = 'ShareCard';

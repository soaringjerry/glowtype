import { Sparkles } from 'lucide-react';

interface ResultCardProps {
    title: string;
    tagline: string;
    description?: string | string[];
    insight?: string | null;
    variant?: 'default' | 'share';
    className?: string;
    textColor?: string;
    cardAccent?: string;
    auraGradient?: string;
}

export function ResultCard({
    title,
    tagline,
    description,
    insight,
    variant = 'default',
    className = '',
    textColor = 'text-slate-950',
    cardAccent = 'from-white/90 to-white/40',
    auraGradient,
}: ResultCardProps) {
    const isShare = variant === 'share';

    // Normalize description to array
    const descLines = Array.isArray(description) ? description : [description || ''];

    return (
        <div
            className={`relative overflow-hidden ${isShare
                    ? `w-full aspect-[3/4.5] rounded-[64px] border-[12px] border-white/80 bg-gradient-to-br ${cardAccent} shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)]`
                    : 'rounded-[32px] border border-sky-300/70 bg-white/90 px-6 py-6 text-center shadow-[0_18px_45px_rgba(56,189,248,0.25)] backdrop-blur'
                } ${className}`}
        >
            {/* Background Effects */}
            {isShare ? (
                <div className="absolute top-[-20%] left-0 w-full h-[80%] flex items-center justify-center overflow-hidden pointer-events-none">
                    <div
                        className="w-[800px] h-[800px] rounded-full blur-[120px] opacity-60"
                        style={{ background: auraGradient }}
                    />
                </div>
            ) : (
                <>
                    <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-sky-200/70 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 right-[-30px] h-44 w-44 rounded-full bg-fuchsia-200/60 blur-3xl" />
                </>
            )}

            {/* Content */}
            <div
                className={`relative z-10 flex flex-col ${isShare ? 'h-full justify-end p-10' : 'items-center space-y-2'
                    }`}
            >
                {isShare ? (
                    // Share Mode Layout
                    <div className="bg-white/70 rounded-[48px] p-10 border border-white/80 shadow-lg backdrop-blur-xl">
                        <div className="mb-10">
                            <h2
                                className={`text-8xl font-bold ${textColor} mb-4 leading-[1.1] tracking-tight`}
                            >
                                {title}
                            </h2>
                            <p className="text-3xl uppercase tracking-[0.15em] text-gray-600 font-bold opacity-70">
                                {tagline}
                            </p>
                        </div>

                        <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-gray-900/10 to-transparent mb-10" />

                        {insight ? (
                            <div className="relative">
                                <Sparkles className="absolute -top-8 -left-2 text-indigo-300 w-12 h-12 opacity-80" />
                                <p className="text-4xl font-medium text-indigo-900 italic leading-relaxed relative z-10">
                                    "{insight}"
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {descLines.map((line, idx) => (
                                    <p
                                        key={idx}
                                        className="text-4xl text-gray-800 leading-relaxed font-medium"
                                    >
                                        {line}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    // Default Mode Layout
                    <>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500">
                            Glowtype
                        </p>
                        <p className="text-3xl font-semibold tracking-tight text-slate-950">
                            {title}
                        </p>
                        <p className="text-sm text-slate-700">{tagline}</p>
                    </>
                )}
            </div>
        </div>
    );
}

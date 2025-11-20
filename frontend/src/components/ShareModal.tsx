import { useRef, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Check, Loader2, Share2, Sparkles } from 'lucide-react';
import html2canvas from 'html2canvas';
import { ShareCard } from './ShareCard';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    insight: string | null;
    lang: 'en' | 'zh';
}

export const ShareModal: FC<ShareModalProps> = ({ isOpen, onClose, data, insight, lang }) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [hasCopied, setHasCopied] = useState(false);

    const handleDownload = async () => {
        if (!cardRef.current) return;
        setIsGenerating(true);
        try {
            // Wait a bit for fonts/images to be fully ready if needed, 
            // though usually they are loaded by now.
            const canvas = await html2canvas(cardRef.current, {
                scale: 2, // High res
                useCORS: true,
                backgroundColor: '#FDFCFE',
                logging: false,
            });

            const link = document.createElement('a');
            link.download = `glowtype-${data.title.en.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error("Failed to generate image", err);
            alert("Oops! Could not generate image. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyLink = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-6xl bg-[#FDFCFE] rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh] md:h-[800px]"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 z-50 p-3 bg-white/80 hover:bg-white rounded-full transition-all text-gray-400 hover:text-gray-900 shadow-sm hover:shadow-md backdrop-blur-sm"
                        >
                            <X size={20} />
                        </button>

                        {/* Preview Section (Left/Top) */}
                        <div className="flex-1 bg-gray-50/50 relative overflow-hidden flex items-center justify-center p-8 md:p-0 group">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />

                            {/* Ambient Background for Preview Area */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-30 pointer-events-none">
                                <div className="w-[600px] h-[600px] bg-gradient-to-tr from-indigo-200 to-purple-200 rounded-full blur-[100px] mix-blend-multiply" />
                            </div>

                            {/* The actual card to be captured (Hidden from view but rendered) */}
                            <div className="fixed left-[-9999px] top-[-9999px]">
                                <ShareCard
                                    ref={cardRef}
                                    title={data.title[lang]}
                                    tagline={data.tagline[lang]}
                                    description={data.description[lang]}
                                    insight={insight}
                                    auraGradient={data.auraGradient}
                                    cardAccent={data.cardAccent}
                                    textColor={data.textColor}
                                    lang={lang}
                                />
                            </div>

                            {/* Visual Preview (Scaled down version for display) */}
                            {/* We use a container that maintains aspect ratio and scales the content */}
                            <div className="relative h-full max-h-[700px] aspect-[9/16] shadow-2xl rounded-[24px] overflow-hidden ring-8 ring-white/50 bg-white transform transition-transform duration-700 hover:scale-[1.02] hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.15)]">
                                <div className="w-[1080px] h-[1920px] origin-top-left transform scale-[0.35] md:scale-[0.38] lg:scale-[0.42] pointer-events-none">
                                    <ShareCard
                                        title={data.title[lang]}
                                        tagline={data.tagline[lang]}
                                        description={data.description[lang]}
                                        insight={insight}
                                        auraGradient={data.auraGradient}
                                        cardAccent={data.cardAccent}
                                        textColor={data.textColor}
                                        lang={lang}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Actions Section (Right/Bottom) */}
                        <div className="w-full md:w-[420px] bg-white p-8 md:p-12 flex flex-col justify-center border-l border-gray-100 relative z-20">
                            <div className="mb-10">
                                <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 shadow-sm">
                                    <Share2 size={28} />
                                </div>
                                <h2 className="text-3xl font-bold text-gray-900 mb-3 tracking-tight">
                                    {lang === 'zh' ? '分享你的光芒' : 'Share your Glow'}
                                </h2>
                                <p className="text-gray-500 leading-relaxed text-lg">
                                    {lang === 'zh'
                                        ? '保存这张卡片到相册，或者复制链接分享给朋友。'
                                        : 'Save this card to your photos or copy the link to share with friends.'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handleDownload}
                                    disabled={isGenerating}
                                    className="w-full py-5 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-gray-900/10 group"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={22} className="animate-spin" />
                                            <span>{lang === 'zh' ? '生成中...' : 'Generating...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={22} className="group-hover:-translate-y-0.5 transition-transform" />
                                            <span>{lang === 'zh' ? '保存卡片' : 'Save Card Image'}</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleCopyLink}
                                    className="w-full py-5 px-6 bg-white border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/50 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 group"
                                >
                                    {hasCopied ? (
                                        <>
                                            <Check size={22} className="text-green-500" />
                                            <span className="text-green-600">{lang === 'zh' ? '已复制链接' : 'Link Copied!'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={22} className="group-hover:scale-110 transition-transform text-gray-400 group-hover:text-indigo-500" />
                                            <span>{lang === 'zh' ? '复制链接' : 'Copy Link'}</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-center gap-2 opacity-60">
                                <Sparkles size={14} className="text-indigo-400" />
                                <p className="text-xs text-gray-400 uppercase tracking-[0.2em] font-medium">
                                    Glowtype // {new Date().getFullYear()}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

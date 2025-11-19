import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Check, Loader2, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { ShareCard } from './ShareCard';

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    data: any;
    insight: string | null;
    lang: 'en' | 'zh';
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, data, insight, lang }) => {
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
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
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
                        className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-50 p-2 bg-white/50 hover:bg-white rounded-full transition-colors text-gray-500 hover:text-gray-900"
                        >
                            <X size={24} />
                        </button>

                        {/* Preview Section (Left/Top) */}
                        <div className="flex-1 bg-gray-100/50 p-6 md:p-12 flex items-center justify-center overflow-hidden relative">
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05]" />

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
                            <div className="relative w-full max-w-[320px] aspect-[9/16] shadow-2xl rounded-[24px] overflow-hidden ring-1 ring-black/5 bg-white transform transition-transform hover:scale-[1.02] duration-500">
                                {/* We render a scaled-down version of the same component for preview, 
                      or we could just render the component directly and scale it with CSS. 
                      Let's render it directly but scaled with CSS transform. */}
                                <div className="w-[1080px] h-[1920px] origin-top-left transform scale-[0.296] pointer-events-none">
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
                        <div className="w-full md:w-[400px] bg-white p-8 flex flex-col justify-center border-l border-gray-100">
                            <div className="mb-8 text-center md:text-left">
                                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-4 mx-auto md:mx-0">
                                    <Share2 size={24} />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                                    {lang === 'zh' ? '分享你的光芒' : 'Share your Glow'}
                                </h2>
                                <p className="text-gray-500">
                                    {lang === 'zh'
                                        ? '保存这张卡片到相册，或者复制链接分享给朋友。'
                                        : 'Save this card to your photos or copy the link to share with friends.'}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <button
                                    onClick={handleDownload}
                                    disabled={isGenerating}
                                    className="w-full py-4 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-xl shadow-gray-900/10"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>{lang === 'zh' ? '生成中...' : 'Generating...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download size={20} />
                                            <span>{lang === 'zh' ? '保存卡片' : 'Save Card Image'}</span>
                                        </>
                                    )}
                                </button>

                                <button
                                    onClick={handleCopyLink}
                                    className="w-full py-4 px-6 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95"
                                >
                                    {hasCopied ? (
                                        <>
                                            <Check size={20} className="text-green-500" />
                                            <span className="text-green-600">{lang === 'zh' ? '已复制链接' : 'Link Copied!'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <Copy size={20} />
                                            <span>{lang === 'zh' ? '复制链接' : 'Copy Link'}</span>
                                        </>
                                    )}
                                </button>
                            </div>

                            <div className="mt-8 pt-8 border-t border-gray-100 text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
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

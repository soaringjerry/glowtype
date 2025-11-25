import React, { useRef, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Check, Loader2, Share2, Zap, Fingerprint } from 'lucide-react';
import html2canvas from 'html2canvas';

type ShareCardData = {
  title: Record<string, string>;
  tagline: Record<string, string>;
  description: Record<string, string>;
  auraGradient: string;
  cardAccent: string;
  textColor: string;
};

type InlineShareCardProps = {
  data: {
    title: string;
    tagline: string;
    description: string;
    auraGradient: string;
    cardAccent: string;
    textColor: string;
  };
  insight: string | null;
  lang: 'en' | 'zh';
  exportMode?: boolean;
};

const InlineShareCard = React.forwardRef<HTMLDivElement, InlineShareCardProps>(
  ({ data, insight, lang, exportMode = false }, ref) => {
    return (
      <div
        ref={ref}
        className="relative w-[1080px] h-[1920px] overflow-hidden font-sans"
        data-share-card
        style={{
          background: exportMode
            ? `linear-gradient(145deg, ${data.cardAccent.includes('from-') ? '#fef3ff' : '#f8f4ff'} 0%, #ffffff 50%, ${data.cardAccent.includes('from-') ? '#f0e6ff' : '#ede9ff'} 100%)`
            : `linear-gradient(145deg, #fef3ff 0%, #ffffff 50%, #f0e6ff 100%)`,
        }}
      >
        {/* Background glow effects */}
        {exportMode ? (
          <>
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] opacity-60"
              style={{
                background: `radial-gradient(circle at 50% 40%, ${data.auraGradient.includes('#') ? data.auraGradient.split(',')[0]?.replace('linear-gradient(', '').trim() || 'rgba(167,139,250,0.7)' : 'rgba(167,139,250,0.7)'}, rgba(139,92,246,0.4) 40%, transparent 70%)`,
              }}
            />
            <div
              className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] opacity-50"
              style={{
                background: 'radial-gradient(circle, rgba(196,181,253,0.6) 0%, rgba(167,139,250,0.3) 50%, transparent 70%)',
              }}
            />
          </>
        ) : (
          <>
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[900px] opacity-70 blur-[100px]"
              style={{ background: data.auraGradient }}
            />
            <div
              className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] opacity-50 blur-[80px]"
              style={{ background: 'radial-gradient(circle, rgba(196,181,253,0.8), transparent 70%)' }}
            />
          </>
        )}

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        {/* Header */}
        <div className="relative z-10 pt-16 px-16 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 bg-slate-900 text-white flex items-center justify-center rounded-2xl shadow-xl">
              <Zap size={32} fill="currentColor" />
            </div>
            <div>
              <span className="text-3xl font-black text-slate-900 tracking-tight">GLOWTYPE</span>
              <div className="text-sm text-slate-400 font-medium tracking-wider mt-1">情绪光谱分析</div>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-16 py-12">
          {/* Aura ball */}
          <div className="relative w-[420px] h-[420px] mb-16">
            {exportMode ? (
              <>
                <div
                  className="absolute inset-0 rounded-full opacity-80"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.9), transparent 50%), radial-gradient(circle, ${data.auraGradient.includes('linear') ? 'rgba(167,139,250,0.9), rgba(139,92,246,0.7)' : data.auraGradient.replace('linear-gradient(', 'radial-gradient(circle,').replace('to right,', '')} 60%, transparent 75%)`,
                    transform: 'scale(1.1)',
                  }}
                />
                <div
                  className="absolute inset-[15%] rounded-full opacity-70"
                  style={{
                    background: 'radial-gradient(circle at 40% 40%, rgba(255,255,255,0.95), rgba(196,181,253,0.5) 60%, transparent 80%)',
                  }}
                />
              </>
            ) : (
              <>
                <div
                  className="absolute inset-0 rounded-full blur-[60px] opacity-90"
                  style={{ background: data.auraGradient }}
                />
                <div
                  className="absolute inset-[10%] rounded-full blur-[40px] opacity-70"
                  style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.8), rgba(196,181,253,0.4))' }}
                />
              </>
            )}
            {/* Inner highlight */}
            <div
              className="absolute inset-[25%] rounded-full opacity-60"
              style={{
                background: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), transparent 60%)',
              }}
            />
          </div>

          {/* Title */}
          <h1 className={`text-7xl font-serif font-bold text-center mb-6 ${data.textColor}`}>
            {data.title}
          </h1>

          {/* Tagline */}
          <p className="text-2xl text-slate-500 font-medium tracking-wide text-center mb-12 uppercase">
            {data.tagline}
          </p>

          {/* Divider */}
          <div className="w-32 h-1 bg-gradient-to-r from-violet-300 via-purple-400 to-violet-300 rounded-full mb-12" />

          {/* Description or Insight */}
          <div className="max-w-[800px] text-center">
            {insight ? (
              <p className="text-3xl leading-relaxed text-violet-600 font-medium italic">
                "{insight}"
              </p>
            ) : (
              <p className="text-2xl leading-relaxed text-slate-600">
                {data.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 pb-16 px-16">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg text-slate-400 font-mono tracking-wider mb-1">
                {lang === 'zh' ? '扫码探索你的光谱' : 'Discover your spectrum'}
              </div>
              <div className="text-2xl font-bold text-slate-700 tracking-wide">
                GLOWTYPE.ME
              </div>
            </div>
            <div className="flex items-center gap-4 bg-white/60 px-6 py-4 rounded-2xl">
              <Fingerprint size={48} className="text-violet-400" strokeWidth={1.5} />
              <div className="text-right">
                <div className="text-sm text-slate-400 font-mono">{lang === 'zh' ? 'AI 生成' : 'AI Generated'}</div>
                <div className="text-lg font-bold text-slate-600">
                  {new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ShareCardData;
  insight: string | null;
  lang: 'en' | 'zh';
}

export const ShareModal: FC<ShareModalProps> = ({
  isOpen,
  onClose,
  data,
  insight,
  lang,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const shareData = {
    title: data.title[lang],
    tagline: data.tagline[lang],
    description: data.description[lang],
    auraGradient: data.auraGradient,
    cardAccent: data.cardAccent,
    textColor: data.textColor,
  };

  const handleDownload = async () => {
    if (!exportRef.current) return;
    setIsGenerating(true);
    try {
      // Preferred path: call render service if configured
      const renderServiceUrl = import.meta.env.VITE_SHARE_RENDER_URL;
      if (renderServiceUrl) {
        const res = await fetch(`${renderServiceUrl.replace(/\/$/, '')}/render`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, insight, lang }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `glowtype-${shareData.title.replace(/\s+/g, '-').toLowerCase()}.png`;
          link.click();
          URL.revokeObjectURL(url);
          setIsGenerating(false);
          return;
        }
      }

      // Use the exportMode version of the card for html2canvas
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        width: 1080,
        height: 1920,
        useCORS: true,
        backgroundColor: '#fafafa',
        logging: false,
        scrollY: 0,
      });

      const link = document.createElement('a');
      link.download = `glowtype-${data.title.en.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to generate image', err);
      alert(lang === 'zh' ? '生成图片失败，请稍后再试。' : 'Could not generate the image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    const url = window.location.href;

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(textarea);
      }
    };

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        fallbackCopy();
      }
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link', err);
      try {
        fallbackCopy();
        setHasCopied(true);
        setTimeout(() => setHasCopied(false), 2000);
      } catch {
        alert(lang === 'zh' ? '复制链接失败，请手动复制地址栏中的链接。' : 'Failed to copy link. Please copy the URL manually.');
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/70 backdrop-blur-lg"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            className="relative w-full max-w-6xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
          >
            {/* Preview */}
            <div className="flex-1 bg-gray-50 relative overflow-hidden flex items-center justify-center p-6 md:p-10">
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.12'/></svg>\")",
                }}
              />
              <div
                className="relative shadow-2xl rounded-[28px] overflow-hidden ring-8 ring-white/60 bg-white"
                style={{ width: 360, height: 640 }}
              >
                <div
                  id="share-card-preview"
                  ref={cardRef}
                  style={{
                    width: 1080,
                    height: 1920,
                    transform: 'scale(0.333)',
                    transformOrigin: 'top left',
                  }}
                >
                  <InlineShareCard data={shareData} insight={insight} lang={lang} />
                </div>
              </div>
            </div>

            {/* Hidden export version for html2canvas */}
            <div
              ref={exportRef}
              aria-hidden="true"
              style={{
                position: 'fixed',
                left: '-9999px',
                top: 0,
                width: 1080,
                height: 1920,
                pointerEvents: 'none',
                zIndex: -1,
              }}
            >
              <InlineShareCard data={shareData} insight={insight} lang={lang} exportMode />
            </div>

            {/* Actions */}
            <div className="w-full md:w-[420px] bg-white p-8 md:p-12 flex flex-col gap-6 border-t md:border-t-0 md:border-l border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                  <Share2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {lang === 'zh' ? '保存或分享' : 'Save or share'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {lang === 'zh'
                      ? '下载高清卡片，或复制链接发送给朋友。'
                      : 'Download a clean image or copy the link to share.'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleDownload}
                  disabled={isGenerating}
                  className="w-full py-4 px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-gray-900/10"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>{lang === 'zh' ? '生成中...' : 'Generating...'}</span>
                    </>
                  ) : (
                    <>
                      <Download size={20} />
                      <span>{lang === 'zh' ? '保存卡片' : 'Save card image'}</span>
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
                      <span className="text-green-600">
                        {lang === 'zh' ? '已复制链接' : 'Link copied'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy size={20} />
                      <span>{lang === 'zh' ? '复制链接' : 'Copy link'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="mt-auto flex justify-end">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <X size={16} />
                  {lang === 'zh' ? '关闭' : 'Close'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

import React, { useMemo, useRef, useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Check, Loader2, Share2, Zap, ScanLine, Fingerprint } from 'lucide-react';
import html2canvas from 'html2canvas';
import { GlowtypeCard } from './GlowtypeCard';

type ShareCardData = {
  title: string;
  tagline: string;
  description: string;
  auraGradient: string;
  cardAccent: string;
  textColor: string;
};

type InlineShareCardProps = {
  data: ShareCardData;
  insight: string | null;
  lang: 'en' | 'zh';
};

const CornerMarks = () => (
  <>
    <div className="absolute top-12 left-12 w-6 h-6 border-t-[1.5px] border-l-[1.5px] border-slate-300/60" />
    <div className="absolute top-12 right-12 w-6 h-6 border-t-[1.5px] border-r-[1.5px] border-slate-300/60" />
    <div className="absolute bottom-12 left-12 w-6 h-6 border-b-[1.5px] border-l-[1.5px] border-slate-300/60" />
    <div className="absolute bottom-12 right-12 w-6 h-6 border-b-[1.5px] border-r-[1.5px] border-slate-300/60" />
  </>
);

const InlineShareCard = React.forwardRef<HTMLDivElement, InlineShareCardProps>(
  ({ data, insight, lang }, ref) => {
    const dateStr = useMemo(
      () =>
        new Date()
          .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          .toUpperCase(),
      [],
    );

    const auraId = useMemo(() => {
      let hash = 0;
      for (let i = 0; i < data.title.length; i++) {
        hash = data.title.charCodeAt(i) + ((hash << 5) - hash);
      }
      return Math.abs(hash % 900) + 100;
    }, [data.title]);

    const noiseBg =
      "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.12'/></svg>";

    return (
      <div
        ref={ref}
        className="relative w-[1080px] h-[1920px] overflow-hidden bg-slate-50 flex flex-col items-center justify-between py-28 font-sans"
      >
        <div className="absolute inset-0 bg-[#fafafa]" />
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'radial-gradient(#00000008 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div
          className="absolute -top-[10%] left-0 w-[100%] h-[50%] opacity-30 blur-[180px]"
          style={{ background: data.auraGradient }}
        />
        <div
          className="absolute bottom-0 right-0 w-[80%] h-[40%] opacity-20 blur-[150px]"
          style={{ background: data.cardAccent }}
        />
        <div
          className="absolute inset-0 opacity-[0.08] mix-blend-multiply"
          style={{ backgroundImage: `url("${noiseBg}")` }}
        />
        <CornerMarks />

        <div className="relative z-10 w-full px-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-900 text-white flex items-center justify-center rounded-2xl shadow-lg shadow-slate-900/20">
              <Zap size={24} fill="currentColor" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">GLOWTYPE</span>
              <span className="text-[11px] text-slate-400 font-mono tracking-[0.25em] uppercase mt-1">Analysis Report</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-slate-400 tracking-widest">{dateStr}</div>
          </div>
        </div>

        <div className="relative z-10 w-[920px] aspect-[3/5] group">
          <div
            className="absolute inset-0 rounded-[48px] translate-x-5 translate-y-5 opacity-40"
            style={{ backgroundColor: data.cardAccent }}
          />
          <div className="absolute -inset-5 border border-slate-900/5 rounded-[64px]" />
          <div className="relative w-full h-full rounded-[48px] overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.05)] bg-white">
            <GlowtypeCard
              data={{
                title: data.title,
                tagline: data.tagline,
                description: data.description,
                auraGradient: data.auraGradient,
                cardAccent: data.cardAccent,
                textColor: data.textColor,
              }}
              insight={insight}
              lang={lang}
              animated={false}
              className="w-full h-full"
            />
          </div>
          <div className="absolute -top-6 -right-6 bg-white px-6 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-full border border-slate-100 transform rotate-6 flex items-center gap-3 z-20">
            <ScanLine size={20} className="text-slate-400" />
            <span className="text-lg font-bold tracking-widest text-slate-800 font-mono">#{auraId}</span>
          </div>
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 w-full px-20">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
          <div className="flex items-end justify-between w-full opacity-60">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-mono text-slate-400 tracking-[0.4em] uppercase">Generated by AI</span>
              <span className="text-xl font-bold text-slate-800 tracking-[0.15em]">GLOWTYPE.ME</span>
            </div>
            <Fingerprint size={40} className="text-slate-300" strokeWidth={1.5} />
          </div>
        </div>
      </div>
    );
  },
);

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    title: Record<string, string>;
    tagline: Record<string, string>;
    description: Record<string, string>;
    auraGradient: string;
    cardAccent: string;
    textColor: string;
  };
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
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      const target = cardRef.current;
      const prevTransform = target.style.transform;
      const prevWidth = target.style.width;
      const prevHeight = target.style.height;

      // Capture at full size to avoid scaled artifacts/black bg.
      target.style.transform = 'none';
      target.style.width = '1080px';
      target.style.height = '1920px';

      const canvas = await html2canvas(target, {
        scale: 2,
        width: 1080,
        height: 1920,
        useCORS: true,
        backgroundColor: '#fdf5ff',
        logging: false,
        scrollY: 0,
      });

      // restore preview styles
      target.style.transform = prevTransform;
      target.style.width = prevWidth;
      target.style.height = prevHeight;

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
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.04]" />
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

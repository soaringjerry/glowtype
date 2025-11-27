import React, { useRef, useState, useEffect, type FC } from 'react';
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
  glowDataUrl?: string;
};

// 使用 Canvas API 绘制模糊光效
const renderGlowToCanvas = (width: number, height: number): string => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 背景渐变
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#fef3ff');
  bgGrad.addColorStop(0.5, '#ffffff');
  bgGrad.addColorStop(1, '#f0e6ff');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 绘制多层光晕模拟模糊效果
  const centerX = width / 2;
  const centerY = height * 0.38; // 球心位置

  // 最外层 - 大范围柔和环境光
  for (let i = 0; i < 25; i++) {
    const radius = 450 - i * 12;
    const alpha = 0.015 + i * 0.006;
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    grad.addColorStop(0, `rgba(167, 139, 250, ${alpha})`);
    grad.addColorStop(0.4, `rgba(139, 92, 246, ${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(139, 92, 246, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 中层 - 紫色光晕过渡
  for (let i = 0; i < 20; i++) {
    const radius = 280 - i * 8;
    const alpha = 0.02 + i * 0.01;
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    grad.addColorStop(0, `rgba(196, 181, 253, ${alpha})`);
    grad.addColorStop(0.5, `rgba(167, 139, 250, ${alpha * 0.6})`);
    grad.addColorStop(1, 'rgba(167, 139, 250, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 内层 - 柔和的球形核心
  for (let i = 0; i < 25; i++) {
    const radius = 160 - i * 4;
    const alpha = 0.03 + i * 0.015;
    const grad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.4, `rgba(237, 233, 254, ${alpha * 0.7})`);
    grad.addColorStop(0.8, `rgba(221, 214, 254, ${alpha * 0.3})`);
    grad.addColorStop(1, 'rgba(221, 214, 254, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  // 高光点 - 球体左上角的反光
  for (let i = 0; i < 15; i++) {
    const radius = 80 - i * 4;
    const alpha = 0.04 + i * 0.02;
    const highlightX = centerX - 40;
    const highlightY = centerY - 50;
    const grad = ctx.createRadialGradient(highlightX, highlightY, 0, highlightX, highlightY, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    grad.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.3})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  }

  return canvas.toDataURL('image/png');
};

const InlineShareCard = React.forwardRef<HTMLDivElement, InlineShareCardProps>(
  ({ data, insight, lang, glowDataUrl }, ref) => {
    return (
      <div
        ref={ref}
        className="relative w-[1080px] h-[1080px] overflow-hidden font-sans"
        data-share-card
        style={{
          background: glowDataUrl
            ? `url(${glowDataUrl})`
            : `linear-gradient(145deg, #fef3ff 0%, #ffffff 50%, #f0e6ff 100%)`,
          backgroundSize: 'cover',
        }}
      >

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }}
        />

        {/* Header */}
        <div className="relative z-10 pt-12 px-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-slate-900 text-white flex items-center justify-center rounded-xl shadow-xl">
              <Zap size={28} fill="currentColor" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 tracking-tight">GLOWTYPE</span>
              <div className="text-xs text-slate-400 font-medium tracking-wider mt-0.5">情绪光谱分析</div>
            </div>
          </div>
          <div className="flex items-center gap-3 bg-white/60 px-5 py-3 rounded-xl">
            <Fingerprint size={32} className="text-violet-400" strokeWidth={1.5} />
            <div className="text-right">
              <div className="text-xs text-slate-400 font-mono">{lang === 'zh' ? 'AI 生成' : 'AI Generated'}</div>
              <div className="text-sm font-bold text-slate-600">
                {new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
        </div>

        {/* Main content area - centered */}
        <div className="relative z-10 flex flex-col items-center justify-center px-14 pt-8 pb-6" style={{ height: 'calc(100% - 180px)' }}>
          {/* Aura ball placeholder - actual glow is in canvas background */}
          <div className="relative w-[280px] h-[280px] mb-10" />

          {/* Title */}
          <h1 className={`text-6xl font-serif font-bold text-center mb-4 ${data.textColor}`}>
            {data.title}
          </h1>

          {/* Tagline */}
          <p className="text-xl text-slate-500 font-medium tracking-wide text-center mb-8 uppercase">
            {data.tagline}
          </p>

          {/* Divider */}
          <div className="w-24 h-1 bg-gradient-to-r from-violet-300 via-purple-400 to-violet-300 rounded-full mb-8" />

          {/* Description or Insight */}
          <div className="max-w-[700px] text-center">
            {insight ? (
              <p className="text-2xl leading-relaxed text-violet-600 font-medium italic">
                "{insight}"
              </p>
            ) : (
              <p className="text-xl leading-relaxed text-slate-600">
                {data.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 z-10 pb-10 px-14">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="text-base text-slate-400 font-mono tracking-wider mb-1">
                {lang === 'zh' ? '扫码探索你的光谱' : 'Discover your spectrum'}
              </div>
              <div className="text-xl font-bold text-slate-700 tracking-wide">
                GLOWTYPE.ME
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
  const [glowDataUrl, setGlowDataUrl] = useState<string>('');

  const shareData = {
    title: data.title[lang],
    tagline: data.tagline[lang],
    description: data.description[lang],
    auraGradient: data.auraGradient,
    cardAccent: data.cardAccent,
    textColor: data.textColor,
  };

  // 预渲染光效
  useEffect(() => {
    if (isOpen && !glowDataUrl) {
      const dataUrl = renderGlowToCanvas(1080, 1080);
      setGlowDataUrl(dataUrl);
    }
  }, [isOpen, glowDataUrl]);

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
        height: 1080,
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
            className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-[24px] md:rounded-[32px] shadow-2xl overflow-y-auto md:overflow-hidden flex flex-col md:flex-row"
          >
            {/* Preview */}
            <div className="flex-1 bg-gray-50 relative overflow-hidden flex items-center justify-center p-4 md:p-10 min-h-[280px] md:min-h-0">
              <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.12'/></svg>\")",
                }}
              />
              <div
                className="relative shadow-2xl rounded-[20px] md:rounded-[28px] overflow-hidden ring-4 md:ring-8 ring-white/60 bg-white w-[240px] h-[240px] md:w-[400px] md:h-[400px]"
              >
                <div
                  id="share-card-preview"
                  ref={cardRef}
                  className="w-[1080px] h-[1080px] origin-top-left scale-[0.222] md:scale-[0.37]"
                >
                  <InlineShareCard data={shareData} insight={insight} lang={lang} glowDataUrl={glowDataUrl} />
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
                height: 1080,
                pointerEvents: 'none',
                zIndex: -1,
              }}
            >
              <InlineShareCard data={shareData} insight={insight} lang={lang} glowDataUrl={glowDataUrl} />
            </div>

            {/* Actions */}
            <div className="w-full md:w-[360px] lg:w-[420px] bg-white p-6 md:p-10 lg:p-12 flex flex-col gap-4 md:gap-6 border-t md:border-t-0 md:border-l border-gray-100">
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

              <div className="space-y-2 md:space-y-3">
                <button
                  onClick={handleDownload}
                  disabled={isGenerating}
                  className="w-full py-3 md:py-4 px-4 md:px-6 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-gray-900/10 text-sm md:text-base"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{lang === 'zh' ? '生成中...' : 'Generating...'}</span>
                    </>
                  ) : (
                    <>
                      <Download size={18} />
                      <span>{lang === 'zh' ? '保存卡片' : 'Save card image'}</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCopyLink}
                  className="w-full py-3 md:py-4 px-4 md:px-6 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 text-gray-700 rounded-xl font-bold flex items-center justify-center gap-2 md:gap-3 transition-all active:scale-95 text-sm md:text-base"
                >
                  {hasCopied ? (
                    <>
                      <Check size={18} className="text-green-500" />
                      <span className="text-green-600">
                        {lang === 'zh' ? '已复制链接' : 'Link copied'}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
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

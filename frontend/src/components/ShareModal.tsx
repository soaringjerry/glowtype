import { useRef, useState, type FC } from 'react';
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
                  <ShareCard {...shareData} insight={insight} lang={lang} />
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

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { TRANSLATIONS, type Lang } from '../config/translations';
import { APP_CONFIG, type GlowStick } from '../config/appConfig';

interface LearnViewProps {
  onBack: () => void;
  lang: Lang;
  userType?: string | null;
}

type Phase = 'cover' | 'chapters' | 'drawing' | 'revealed';

export const LearnView = ({ onBack, lang, userType = null }: LearnViewProps) => {
  const t = TRANSLATIONS[lang].learn;
  const chapters = APP_CONFIG.bookChapters;
  const allSticks = APP_CONFIG.glowSticks;
  const [phase, setPhase] = useState<Phase>('cover');
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [currentStick, setCurrentStick] = useState<GlowStick | null>(null);
  const [drawnIds, setDrawnIds] = useState<number[]>([]);

  // Pre-compute random particle data to avoid impure render
  const particleData = useMemo(() =>
    [...Array(20)].map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      duration: 3 + Math.random() * 2,
      delay: Math.random() * 3,
    })), []
  );

  // Get sticks pool based on selected chapter
  const getStickPool = () => {
    let pool = [...allSticks];
    if (selectedChapter && selectedChapter !== 'random') {
      pool = pool.filter(s => s.planet === selectedChapter);
    }
    pool = pool.filter(s => !drawnIds.includes(s.id));
    if (pool.length === 0) {
      setDrawnIds([]);
      pool = selectedChapter && selectedChapter !== 'random'
        ? allSticks.filter(s => s.planet === selectedChapter)
        : [...allSticks];
    }
    if (userType && pool.length > 1) {
      const typeMapping: Record<string, string> = {
        'quiet-comet': 'Quiet Comet', 'radiant-nebula': 'Radiant Nebula',
        'Quiet Comet': 'Quiet Comet', 'Radiant Nebula': 'Radiant Nebula'
      };
      const mappedType = typeMapping[userType] || userType;
      const matching = pool.filter(s => s.forTypes?.includes(mappedType));
      if (matching.length > 0 && Math.random() < 0.7) return matching;
    }
    return pool;
  };

  const openBook = () => setPhase('chapters');

  const selectChapter = (chapterId: string) => {
    setSelectedChapter(chapterId);
    setPhase('drawing');
    setTimeout(() => {
      const pool = getStickPool();
      const stick = pool[Math.floor(Math.random() * pool.length)];
      setCurrentStick(stick);
      setDrawnIds(prev => [...prev, stick.id]);
      setPhase('revealed');
    }, 1800);
  };

  const drawAgain = () => {
    setCurrentStick(null);
    setPhase('chapters');
  };

  const backToCover = () => {
    setPhase('cover');
    setSelectedChapter(null);
    setCurrentStick(null);
  };

  const currentChapter = chapters.find(c => c.id === selectedChapter);

  return (
    <div className="min-h-screen relative z-10 flex flex-col items-center justify-center px-4 md:px-6 py-24 md:py-20">
      {/* Magical background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden bg-gradient-to-b from-slate-900 via-purple-950 to-slate-900">
        {/* Floating particles */}
        {particleData.map((p) => (
          <motion.div
            key={p.id}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{ left: p.left, top: p.top }}
            animate={{ opacity: [0, 1, 0], y: [0, -30, -60] }}
            transition={{ duration: p.duration, repeat: Infinity, delay: p.delay }}
          />
        ))}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] bg-purple-500/10 rounded-full blur-[120px]" />
      </div>

      {/* Back button - positioned below navbar */}
      <button
        onClick={onBack}
        className="fixed top-20 md:top-[76px] left-4 md:left-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors z-20 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm"
      >
        <ArrowRight className="rotate-180" size={16} /> {t.back}
      </button>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-sm">
        <AnimatePresence mode="wait">
          {/* Book Cover */}
          {phase === 'cover' && (
            <motion.div
              key="cover"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, rotateY: -90 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              <motion.div
                whileHover={{ scale: 1.02, rotateY: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={openBook}
                className="relative cursor-pointer group"
                style={{ perspective: 1000 }}
              >
                {/* Book */}
                <div className="relative w-56 h-72 bg-gradient-to-br from-amber-800 via-amber-900 to-amber-950 rounded-r-lg rounded-l-sm shadow-2xl border-l-8 border-amber-700">
                  {/* Book spine texture */}
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-r from-amber-950 to-transparent" />

                  {/* Cover decoration */}
                  <div className="absolute inset-4 border-2 border-amber-600/30 rounded-lg" />
                  <div className="absolute inset-6 border border-amber-500/20 rounded" />

                  {/* Title area */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-4xl mb-4"
                    >✨</motion.div>
                    <h2 className="text-amber-200 font-serif text-xl font-bold text-center tracking-wide">{t.title}</h2>
                    <div className="w-16 h-0.5 bg-amber-500/50 my-3" />
                    <p className="text-amber-300/60 text-xs text-center">{t.subtitle}</p>
                  </div>

                  {/* Glow effect */}
                  <motion.div
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -inset-4 bg-amber-500/20 rounded-xl blur-2xl -z-10"
                  />
                </div>

                {/* Page edges */}
                <div className="absolute right-0 top-2 bottom-2 w-3 bg-gradient-to-r from-amber-100 to-amber-50 rounded-r-sm shadow-inner" style={{ transform: 'translateX(100%)' }}>
                  <div className="absolute inset-y-0 left-0 w-px bg-amber-300/50" />
                  <div className="absolute inset-y-0 left-1 w-px bg-amber-200/30" />
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-amber-200/60 text-sm"
              >
                {lang === 'zh' ? '点击翻开魔法书' : 'Tap to open the book'}
              </motion.p>
            </motion.div>
          )}

          {/* Chapters (Book open) */}
          {phase === 'chapters' && (
            <motion.div
              key="chapters"
              initial={{ opacity: 0, rotateY: 90 }}
              animate={{ opacity: 1, rotateY: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              className="flex flex-col items-center"
            >
              {/* Open book pages */}
              <div className="relative bg-amber-50 rounded-lg shadow-2xl p-6 w-full max-w-sm">
                {/* Page texture */}
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNmZmYiLz48cmVjdCB3aWR0aD0iMSIgaGVpZ2h0PSIxIiBmaWxsPSIjZjVmNWY0Ii8+PC9zdmc+')] opacity-50 rounded-lg" />

                <div className="relative">
                  <h3 className="text-amber-900 font-serif text-lg text-center mb-1">{t.pickPlanet}</h3>
                  <div className="w-12 h-0.5 bg-amber-300 mx-auto mb-4" />

                  <div className="space-y-2">
                    {chapters.map((chapter, idx) => (
                      <motion.button
                        key={chapter.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                        onClick={() => selectChapter(chapter.id)}
                        className="w-full text-left p-3 rounded-lg hover:bg-amber-100 transition-colors group flex items-center gap-3"
                      >
                        <span className="text-xl">{chapter.icon}</span>
                        <div className="flex-1">
                          <div className="text-amber-900 font-medium text-sm">{chapter.name[lang]}</div>
                          <div className="text-amber-600/70 text-xs">{chapter.desc[lang]}</div>
                        </div>
                        <ArrowRight size={14} className="text-amber-400 group-hover:text-amber-600 group-hover:translate-x-1 transition-all" />
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Book shadow */}
                <div className="absolute -bottom-2 left-4 right-4 h-4 bg-black/10 blur-md rounded-full" />
              </div>

              <button onClick={backToCover} className="mt-6 text-amber-200/60 text-sm hover:text-amber-200 transition-colors">
                {lang === 'zh' ? '合上书本' : 'Close book'}
              </button>
            </motion.div>
          )}

          {/* Drawing animation */}
          {phase === 'drawing' && (
            <motion.div
              key="drawing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <motion.div
                animate={{ rotateY: [0, 180, 360] }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
                className="w-48 h-64 bg-amber-50 rounded-lg shadow-2xl flex items-center justify-center"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="text-4xl"
                >✨</motion.div>
              </motion.div>
              <p className="mt-6 text-amber-200/80 animate-pulse">
                {lang === 'zh' ? '书页正在翻动...' : 'Pages are turning...'}
              </p>
            </motion.div>
          )}

          {/* Revealed - Glowing card from book */}
          {phase === 'revealed' && currentStick && (
            <motion.div
              key="revealed"
              initial={{ opacity: 0, y: 50, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", damping: 15 }}
              className="flex flex-col items-center w-full"
            >
              {/* Chapter indicator */}
              {currentChapter && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 text-amber-200/60 text-sm flex items-center gap-2"
                >
                  <span>{currentChapter.icon}</span>
                  <span>{currentChapter.name[lang]}</span>
                </motion.div>
              )}

              {/* The revealed message - looks like a glowing page */}
              <motion.div
                initial={{ rotateX: 90 }}
                animate={{ rotateX: 0 }}
                transition={{ duration: 0.6 }}
                className="w-full"
              >
                <div className={`relative p-8 rounded-2xl bg-gradient-to-br ${currentStick.color} shadow-2xl overflow-hidden`}>
                  {/* Magical shimmer */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                  />

                  <div className="relative z-10 text-white text-center">
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.3, type: "spring" }}
                      className="w-14 h-14 mx-auto mb-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl"
                    >
                      ✨
                    </motion.div>
                    <h3 className="text-xl font-bold mb-3 font-serif">{currentStick.title[lang]}</h3>
                    <p className="text-white/90 leading-relaxed">{currentStick.message[lang]}</p>
                  </div>

                  {/* Corner decorations */}
                  <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-white/20 rounded-tl-lg" />
                  <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-white/20 rounded-br-lg" />
                </div>
              </motion.div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={drawAgain}
                  className="px-5 py-2.5 bg-white/10 backdrop-blur-sm text-white rounded-xl text-sm font-medium border border-white/20 hover:bg-white/20 transition-all"
                >
                  {t.redraw}
                </button>
                <button
                  onClick={onBack}
                  className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium shadow-lg hover:bg-amber-400 transition-all"
                >
                  {t.keep}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

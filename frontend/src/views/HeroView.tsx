import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { TRANSLATIONS, type Lang } from '../config/translations';

interface HeroViewProps {
  onStart: () => void;
  onViewSafety: () => void;
  lang: Lang;
}

export const HeroView = ({ onStart, onViewSafety, lang }: HeroViewProps) => {
  const t = TRANSLATIONS[lang].hero;

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-6 pt-32 relative z-10">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.2 }}>
        <span className="inline-block py-1 px-3 rounded-full bg-white/50 border border-white/60 text-gray-500 text-sm font-medium mb-6 backdrop-blur-md">
          {t.tag}
        </span>
        <h1 className="text-6xl md:text-7xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6">
          {t.titlePre} <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">{t.titleHighlight}</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto mb-10 leading-relaxed">
          {t.subtitle}
        </p>

        <div className="flex flex-col gap-4 w-full max-w-xs mx-auto relative z-20">
          <Button onClick={onStart} icon={ArrowRight} className="w-full">{t.btnStart}</Button>
          <Button variant="ghost" onClick={onViewSafety} className="text-sm text-gray-500">{t.btnSafe}</Button>
        </div>
      </motion.div>

      {/* Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 60, rotateX: 10 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, delay: 0.4, type: "spring" }}
        className="mt-16 relative perspective-1000"
      >
        <div className="relative w-56 aspect-[3/4.5] bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-2xl rounded-[32px] border-[6px] border-white/50 shadow-2xl shadow-indigo-200/40 flex flex-col justify-between overflow-hidden transform rotate-[-3deg] hover:rotate-0 transition-transform duration-500">
          {/* Aura Blob */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-32 h-32 bg-gradient-to-tr from-indigo-400 via-purple-400 to-rose-300 rounded-full blur-[50px]"
            />
          </div>

          {/* Glass Reflection */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-50 pointer-events-none" />

          {/* Abstract UI Lines */}
          <div className="z-10 p-6 h-full flex flex-col justify-end">
            <div className="p-4 bg-white/40 backdrop-blur-md rounded-2xl border border-white/40 space-y-2 shadow-sm">
              <div className="w-8 h-1 bg-indigo-900/20 rounded-full mb-2" />
              <div className="w-full h-2 bg-indigo-900/10 rounded-full" />
              <div className="w-2/3 h-2 bg-indigo-900/10 rounded-full" />
            </div>
          </div>
        </div>

        {/* Ground Reflection */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 w-40 h-12 bg-indigo-300/30 blur-2xl rounded-[100%]" />
      </motion.div>
    </div>
  );
};

import { memo } from 'react';
import { motion } from 'framer-motion';

export const GlobalBackground = memo(() => (
  <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#FDFCFE]">
    <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-darken" />
    <motion.div
      animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], x: [0, 50, 0] }}
      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
      className="absolute top-[-10%] -left-[10%] w-[50vw] h-[50vw] bg-purple-200/40 rounded-full blur-[80px] mix-blend-multiply will-change-transform"
    />
    <motion.div
      animate={{ scale: [1, 1.1, 1], x: [0, -30, 0], y: [0, 50, 0] }}
      transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
      className="absolute bottom-[-10%] -right-[10%] w-[50vw] h-[50vw] bg-blue-200/40 rounded-full blur-[80px] mix-blend-multiply will-change-transform"
    />
    <motion.div
      animate={{ scale: [1, 1.3, 1] }}
      transition={{ duration: 18, repeat: Infinity }}
      className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] bg-pink-100/50 rounded-full blur-[100px] mix-blend-multiply will-change-transform"
    />
  </div>
));

GlobalBackground.displayName = 'GlobalBackground';

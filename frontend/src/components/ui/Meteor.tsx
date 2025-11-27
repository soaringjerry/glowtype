import { memo } from 'react';
import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';

interface MeteorProps {
  delay: number;
  duration: number;
  style?: CSSProperties;
}

export const Meteor = memo(({ delay, duration, style }: MeteorProps) => (
  <motion.div
    initial={{ top: -100, left: '120%', opacity: 0 }}
    animate={{ top: '120%', left: '-20%', opacity: [0, 1, 0] }}
    transition={{
      duration: duration,
      delay: delay,
      repeat: Infinity,
      repeatDelay: Math.random() * 3 + 2,
      ease: "linear"
    }}
    className="absolute w-[2px] h-[120px] bg-gradient-to-b from-transparent via-white to-transparent rotate-45 z-0 shadow-[0_0_8px_rgba(255,255,255,0.8)] will-change-transform"
    style={style}
  >
    {/* Sparkling Head */}
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full" />
  </motion.div>
));

Meteor.displayName = 'Meteor';

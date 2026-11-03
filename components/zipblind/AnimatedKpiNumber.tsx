'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';

interface AnimatedKpiNumberProps {
  value: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export default function AnimatedKpiNumber({
  value,
  suffix = '',
  prefix = '',
  className = '',
}: AnimatedKpiNumberProps) {
  const [displayValue, setDisplayValue] = useState<number>(value);

  useEffect(() => {
    let animationFrameId: number;
    const duration = 650;
    const startTime = performance.now();
    const startVal = 0;

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Cubic ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startVal + (value - startVal) * eased));
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  return (
    <motion.span
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`font-sans font-bold tabular-nums tracking-[-0.02em] ${className}`}
    >
      {prefix}
      {displayValue.toLocaleString('id-ID')}
      {suffix}
    </motion.span>
  );
}

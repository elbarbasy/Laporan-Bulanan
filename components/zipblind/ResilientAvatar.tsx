'use client';

import React, { useState } from 'react';
import { ShieldCheck, UserCheck } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  variant?: 'avatar' | 'mascot' | 'gallery';
}

export default function ResilientImage({
  src,
  alt,
  className = '',
  fallbackLabel = 'ZB',
  variant = 'avatar',
}: ResilientImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-ocean-blue text-white select-none overflow-hidden ${className}`}
        role="img"
        aria-label={alt}
      >
        {variant === 'mascot' ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <ShieldCheck className="w-10 h-10 text-[#9AE6D5] mb-2" />
            <span className="text-xs font-semibold tracking-wide text-white/90">
              {fallbackLabel}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1">
            <UserCheck className="w-4 h-4 text-[#9AE6D5]" />
            <span className="text-xs font-bold tracking-wider">{fallbackLabel}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`object-cover ${className}`}
    />
  );
}

import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showWordmark?: boolean;
  animated?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showWordmark = true,
  animated = false,
}) => {
  const sizeMap = {
    sm: { icon: 24, text: 'text-sm' },
    md: { icon: 32, text: 'text-lg' },
    lg: { icon: 44, text: 'text-2xl' },
    xl: { icon: 64, text: 'text-4xl' },
  };

  const { icon: pxSize, text: textSize } = sizeMap[size];

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Original Geometric Emblem for VYRN: Interlocking Angular Facets */}
      <svg
        width={pxSize}
        height={pxSize}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${animated ? 'transition-transform duration-500 hover:rotate-6' : ''}`}
        aria-label="VYRN Emblem"
      >
        <defs>
          <linearGradient id="vyrnMoltenGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF5A1F" />
            <stop offset="100%" stopColor="#FF3300" />
          </linearGradient>
          <linearGradient id="vyrnLimeGlow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#D7FF38" />
            <stop offset="100%" stopColor="#BCE822" />
          </linearGradient>
          <linearGradient id="vyrnCarbonFacet" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#252723" />
            <stop offset="100%" stopColor="#141512" />
          </linearGradient>
        </defs>

        {/* Outer Hex-Angular Shard (Base) */}
        <polygon
          points="50,6 92,28 92,72 50,94 8,72 8,28"
          fill="url(#vyrnCarbonFacet)"
          stroke="#2E312B"
          strokeWidth="2.5"
        />

        {/* Angular V-Y Monolith (Molten Orange) */}
        <polygon
          points="50,18 78,32 50,68 22,32"
          fill="url(#vyrnMoltenGlow)"
          opacity="0.95"
        />

        {/* Interlocking Diamond Spear (Acid Lime) */}
        <polygon
          points="50,42 66,66 50,86 34,66"
          fill="url(#vyrnLimeGlow)"
        />

        {/* Sharp Central Negative Space Notch (Carbon Core) */}
        <polygon
          points="50,30 60,45 50,60 40,45"
          fill="#191A17"
        />

        {/* Precision Geometric Accent Lines */}
        <line x1="50" y1="6" x2="50" y2="18" stroke="#D7FF38" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="72" x2="22" y2="66" stroke="#FF5A1F" strokeWidth="2" strokeLinecap="round" />
        <line x1="92" y1="72" x2="78" y2="66" stroke="#FF5A1F" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {showWordmark && (
        <span
          className={`font-extrabold tracking-widest text-[#F2EBDD] font-mono uppercase ${textSize}`}
          style={{ letterSpacing: '0.22em' }}
        >
          VYRN
        </span>
      )}
    </div>
  );
};

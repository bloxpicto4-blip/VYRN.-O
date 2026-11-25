import React, { useState, useEffect } from 'react';
import { Logo } from '../brand/Logo';

interface CinematicIntroProps {
  onComplete: () => void;
  brandTagline?: string;
  forceShow?: boolean;
}

export const CinematicIntro: React.FC<CinematicIntroProps> = ({
  onComplete,
  brandTagline = 'عالم تصنعه بنفسك.',
  forceShow = false,
}) => {
  const [phase, setPhase] = useState<number>(1);
  const [isFading, setIsFading] = useState<boolean>(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hasSeen = sessionStorage.getItem('vyrn_intro_seen');

    if (!forceShow && (hasSeen === 'true' || prefersReducedMotion)) {
      onComplete();
      return;
    }

    // Phase 1: Emblem emergence (0 - 1.2s)
    const timer1 = setTimeout(() => {
      setPhase(2);
    }, 1200);

    // Phase 2: Tagline reveal (1.2s - 2.8s)
    const timer2 = setTimeout(() => {
      setPhase(3);
    }, 2800);

    // Phase 3: Transition to homepage (3.4s)
    const timer3 = setTimeout(() => {
      handleDismiss();
    }, 3600);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [forceShow]);

  const handleDismiss = () => {
    sessionStorage.setItem('vyrn_intro_seen', 'true');
    setIsFading(true);
    setTimeout(() => {
      onComplete();
    }, 600);
  };

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#141512] transition-opacity duration-700 ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background geometric grid and subtle ambient rim lighting */}
      <div className="absolute inset-0 opacity-15 pointer-events-none bg-[radial-gradient(#FF5A1F_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#FF5A1F]/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Skip Button */}
      <button
        onClick={handleDismiss}
        className="absolute top-6 left-6 px-4 py-2 text-xs font-mono tracking-wider text-[#F2EBDD]/70 hover:text-[#D7FF38] border border-[#2E312B] hover:border-[#D7FF38] rounded transition-colors cursor-pointer z-10"
      >
        تخطي المقدمة [ESC]
      </button>

      {/* Main Center Composition */}
      <div className="relative flex flex-col items-center text-center px-6">
        {/* Animated Emblem */}
        <div
          className={`transform transition-all duration-1000 ${
            phase >= 1 ? 'scale-100 opacity-100' : 'scale-90 opacity-0'
          }`}
        >
          <div className="relative p-6">
            <div className="absolute inset-0 bg-[#FF5A1F]/10 blur-xl rounded-full animate-pulse" />
            <Logo size="xl" showWordmark={false} />
          </div>
        </div>

        {/* Brand Name Typography */}
        <div
          className={`mt-4 transform transition-all duration-700 delay-200 ${
            phase >= 1 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <h1 className="text-4xl md:text-5xl font-mono font-black tracking-[0.3em] text-[#F2EBDD] uppercase">
            VYRN
          </h1>
        </div>

        {/* Tagline Reveal in Arabic */}
        <div
          className={`mt-3 max-w-md transform transition-all duration-700 ${
            phase >= 2 ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <p className="text-base md:text-lg text-[#F2EBDD]/90 font-medium tracking-wide">
            {brandTagline}
          </p>
        </div>

        {/* Sub-bar indicator */}
        <div
          className={`mt-8 w-32 h-[2px] bg-[#2E312B] overflow-hidden rounded-full transition-opacity duration-500 ${
            phase >= 2 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="h-full bg-gradient-to-r from-[#FF5A1F] to-[#D7FF38] animate-[shimmer_2s_infinite] w-full" />
        </div>
      </div>
    </div>
  );
};

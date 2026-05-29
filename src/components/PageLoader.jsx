import React, { useEffect, useState } from 'react';
import Logo from './Logo';

const PageLoader = ({ isVisible }) => {
  const [shouldRender, setShouldRender] = useState(isVisible);

  useEffect(() => {
    if (isVisible) setShouldRender(true);
  }, [isVisible]);

  const handleAnimationEnd = () => {
    if (!isVisible) setShouldRender(false);
  };

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-mist-white transition-opacity duration-700 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      onTransitionEnd={handleAnimationEnd}
    >
      <div className="flex flex-col items-center">
        {/* Cropped Vector Logo */}
        <Logo className="w-48 sm:w-64 h-auto mb-8 animate-[pulse_2s_ease-in-out_infinite] text-slate-stone" />

        <div className="font-sans text-stone-gray text-[10px] tracking-widest mt-3 opacity-60">
          Swiss Purity Loading
        </div>
      </div>
    </div>
  );
};

export default PageLoader;

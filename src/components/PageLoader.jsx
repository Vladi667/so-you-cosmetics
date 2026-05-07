import React, { useEffect, useState } from 'react';

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
        {/* Minimalist Swiss Mountain & Water SVG */}
        <svg 
          width="120" 
          height="120" 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          className="mb-8"
        >
          {/* Water ripples */}
          <path 
            d="M 20 75 Q 35 65 50 75 T 80 75" 
            stroke="#A5B4C2" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            className="animate-[dash_3s_ease-in-out_infinite] opacity-60"
            strokeDasharray="100"
            strokeDashoffset="0"
          />
          <path 
            d="M 30 85 Q 45 75 60 85 T 90 85" 
            stroke="#A5B4C2" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            className="animate-[dash_3s_ease-in-out_infinite_0.5s] opacity-40"
            strokeDasharray="100"
            strokeDashoffset="0"
          />
          {/* Minimalist Matterhorn-esque Mountain */}
          <path 
            d="M 15 70 L 45 20 L 55 35 L 65 25 L 85 70" 
            stroke="#2A3439" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className="animate-[draw_2s_ease-in-out_forwards]"
            strokeDasharray="200"
            strokeDashoffset="200"
          />
          {/* Sun / Droplet hybrid */}
          <circle 
            cx="50" 
            cy="45" 
            r="4" 
            fill="#D9E0E3" 
            className="animate-[pulse_2s_ease-in-out_infinite]"
          />
        </svg>

        <div className="font-serif text-slate-stone text-xl tracking-[0.2em] uppercase animate-pulse">
          So You Cosmetics
        </div>
        <div className="font-sans text-stone-gray text-[10px] tracking-widest mt-3 opacity-60">
          Swiss Purity Loading
        </div>
      </div>
    </div>
  );
};

export default PageLoader;

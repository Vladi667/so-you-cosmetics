import React from 'react';
import AutoPlayVideo from './AutoPlayVideo';

const Hero = () => {
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      <AutoPlayVideo
        src="/hero-video.mp4"
        className="absolute inset-0 z-0 w-full h-full object-cover sepia-[.03]"
        poster="/fallback-poster.jpg"
      />

      {/* Vignette: darkens edges to draw focus to center */}
      <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)' }}></div>
      {/* Warm amber whisper */}
      <div className="absolute inset-0 z-10 bg-amber-900/[0.04]"></div>
      {/* Top gradient for navbar readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-transparent"></div>
      
      <div className="relative z-20 text-center px-4 max-w-4xl mx-auto flex flex-col items-center mt-20">
        <h1 className="font-serif text-5xl md:text-7xl text-ivory mb-6 leading-tight opacity-0 animate-[fadeIn_1.5s_ease-out_forwards]" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
          Natural Cosmetics,<br/>Handmade in Geneva
        </h1>
        
        <p className="font-sans text-base md:text-xl text-ivory/90 mb-10 max-w-2xl opacity-0 animate-[fadeInUp_1.5s_ease-out_0.5s_forwards]" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2)' }}>
          Artisanal soaps, bath rituals, body care and botanical wellness crafted with Swiss purity.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 opacity-0 animate-[fadeInUp_2s_ease-out_1s_forwards]">
          <a href="#products" className="px-8 py-4 bg-white text-slate-stone font-sans uppercase tracking-[0.2em] text-xs hover:bg-slate-stone hover:text-white transition-all duration-500 shadow-lg rounded-full text-center">
            Discover the Collection
          </a>
          <a href="#workshops" className="px-8 py-4 border border-white/50 text-white font-sans uppercase tracking-[0.2em] text-xs hover:bg-white/10 hover:border-white transition-all duration-500 backdrop-blur-sm rounded-full text-center">
            Our Workshops
          </a>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-pulse opacity-50 hover:opacity-100 transition-opacity duration-500 cursor-pointer hidden sm:flex">
        <span className="text-white font-sans text-[10px] uppercase tracking-widest mb-3">Scroll</span>
        <div className="w-[1px] h-16 bg-gradient-to-b from-white to-transparent"></div>
      </div>
    </section>
  );
};

export default Hero;

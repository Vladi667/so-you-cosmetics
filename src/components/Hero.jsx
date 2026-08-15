import React from 'react';
import AutoPlayVideo from './AutoPlayVideo';
import { useLanguage } from '../i18n/LanguageContext';

// The client asked for a button linking to her Marie Claire article but has not
// sent the URL yet. Fill this in and the button appears; left empty it stays
// hidden, so nothing broken ships in the meantime.
const MARIE_CLAIRE_URL = '';

const Hero = () => {
  const { t } = useLanguage();
  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      <AutoPlayVideo
        src="/hero-video.mp4"
        className="absolute inset-0 z-0 w-full h-full object-cover sepia-[.03]"
      />

      {/* Vignette: darkens edges to draw focus to center */}
      <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)' }}></div>
      {/* Warm amber whisper */}
      <div className="absolute inset-0 z-10 bg-amber-900/[0.04]"></div>
      {/* Top gradient for navbar readability */}
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-transparent"></div>
      
      <div className="relative z-20 text-center px-4 max-w-4xl mx-auto flex flex-col items-center mt-16 sm:mt-20">
        <h1 className="leading-[1.06] font-serif text-3xl sm:text-5xl md:text-7xl text-ivory mb-4 sm:mb-6 opacity-0 animate-[fadeIn_1.5s_ease-out_forwards]" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
          {t('hero.titleLine1')}<br/>{t('hero.titleLine2')}
        </h1>

        <p className="font-sans text-sm sm:text-base md:text-xl text-ivory/90 mb-6 sm:mb-10 max-w-2xl opacity-0 animate-[fadeInUp_1.5s_ease-out_0.5s_forwards]" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2)' }}>
          {t('hero.subtitle')}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 opacity-0 animate-[fadeInUp_2s_ease-out_1s_forwards] w-full sm:w-auto px-4 sm:px-0">
          <a href="#products" className="px-6 sm:px-8 py-3 sm:py-4 bg-ivory text-slate-stone font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs hover:bg-slate-stone hover:text-white transition-all duration-250 shadow-lg rounded-full text-center active:scale-[0.97]">
            {t('hero.cta1')}
          </a>
          <a href="#workshops" className="px-6 sm:px-8 py-3 sm:py-4 border border-white/50 text-white font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs hover:bg-white/10 hover:border-white transition-all duration-250 backdrop-blur-sm rounded-full text-center active:scale-[0.97]">
            {t('hero.cta2')}
          </a>
          {MARIE_CLAIRE_URL && (
            <a
              href={MARIE_CLAIRE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 sm:px-8 py-3 sm:py-4 border border-white/50 text-white font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs hover:bg-white/10 hover:border-white transition-all duration-250 backdrop-blur-sm rounded-full text-center active:scale-[0.97]"
            >
              {t('hero.marieClaire')}
            </a>
          )}
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex flex-col items-center animate-pulse opacity-50 hover:opacity-100 transition-opacity duration-500 cursor-pointer hidden sm:flex">
        <span className="text-white font-sans text-[10px] uppercase tracking-widest mb-3">{t('hero.scroll')}</span>
        <div className="w-[1px] h-16 bg-gradient-to-b from-white to-transparent"></div>
      </div>
    </section>
  );
};

export default Hero;

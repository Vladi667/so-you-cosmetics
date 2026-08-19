import React from 'react';
import AutoPlayVideo from './AutoPlayVideo';
import { useLanguage } from '../i18n/LanguageContext';

// The client asked for a button linking to her Marie Claire article but has not
// sent the URL yet. Fill this in and the button appears; left empty it stays
// hidden, so nothing broken ships in the meantime.
const MARIE_CLAIRE_URL = '';

// Composition follows the mockup she supplied: the wordmark leads, the promise
// sits under it, then a rule, then the two-line nature/science couplet. The
// workshops CTA moved out of the hero at her request — it now lives in the
// workshops section, where the context is.
const Hero = () => {
  const { t } = useLanguage();

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      <AutoPlayVideo
        src="/hero-video.mp4"
        className="absolute inset-0 z-0 w-full h-full object-cover sepia-[.04] saturate-[.92] brightness-105
                   motion-safe:animate-[heroDrift_28s_ease-in-out_infinite]"
      />

      {/* Warm grade. The vignette is softer than before so the travertine tones
          in the footage survive instead of being crushed to grey at the edges. */}
      <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(58,51,43,0.08) 0%, rgba(58,51,43,0.06) 45%, rgba(58,51,43,0.42) 100%)' }} />
      <div className="absolute inset-0 z-10 bg-[#B9A891]/[0.10] mix-blend-soft-light" />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-transparent to-black/25" />

      <div className="relative z-20 text-center px-5 max-w-3xl mx-auto flex flex-col items-center mt-14 sm:mt-16">
        {/* Wordmark */}
        <p
          className="font-serif text-ivory text-5xl sm:text-6xl md:text-7xl mb-5 sm:mb-7
                     opacity-0 animate-[fadeIn_1.1s_cubic-bezier(0.16,1,0.3,1)_forwards]"
          style={{ letterSpacing: '-0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.28)' }}
        >
          {t('hero.brand')}
        </p>

        {/* The promise */}
        <h1
          className="font-serif font-light text-ivory text-[1.375rem] sm:text-3xl md:text-[2.6rem] leading-[1.18] max-w-2xl
                     opacity-0 animate-[fadeInUp_1.1s_cubic-bezier(0.16,1,0.3,1)_0.18s_forwards]"
          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.25)' }}
        >
          {t('hero.titleLine1')}<br className="hidden sm:block" /> {t('hero.titleLine2')}
        </h1>

        {/* Hairline — the divider she drew between the two thoughts */}
        <span
          className="block h-px w-14 sm:w-20 bg-ivory/45 my-6 sm:my-8 origin-center
                     opacity-0 animate-[fadeIn_0.9s_ease-out_0.5s_forwards]"
        />

        {/* Nature / science couplet */}
        <p
          className="font-sans font-light text-ivory/85 text-[0.8125rem] sm:text-base leading-relaxed
                     opacity-0 animate-[fadeInUp_1.1s_cubic-bezier(0.16,1,0.3,1)_0.62s_forwards]"
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.38)' }}
        >
          {t('hero.subtitleLine1')}<br />{t('hero.subtitleLine2')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-9 sm:mt-11 w-full sm:w-auto px-2 sm:px-0
                        opacity-0 animate-[fadeInUp_1.1s_cubic-bezier(0.16,1,0.3,1)_0.9s_forwards]">
          <a
            href="#products"
            className="px-8 sm:px-10 py-3.5 sm:py-4 bg-ivory text-slate-stone font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs
                       hover:bg-ivory/90 transition-all duration-250 shadow-lg rounded-full text-center active:scale-[0.97]"
          >
            {t('hero.cta1')}
          </a>
          {MARIE_CLAIRE_URL && (
            <a
              href={MARIE_CLAIRE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 sm:px-10 py-3.5 sm:py-4 border border-ivory/45 text-ivory font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs
                         hover:bg-ivory/10 hover:border-ivory/70 transition-all duration-250 backdrop-blur-sm rounded-full text-center active:scale-[0.97]"
            >
              {t('hero.marieClaire')}
            </a>
          )}
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex-col items-center opacity-45 hover:opacity-90 transition-opacity duration-250 cursor-pointer hidden sm:flex">
        <span className="text-ivory font-sans text-[10px] uppercase tracking-[0.25em] mb-3">{t('hero.scroll')}</span>
        <span className="block w-px h-14 bg-gradient-to-b from-ivory to-transparent motion-safe:animate-[scrollHint_2.4s_ease-in-out_infinite]" />
      </div>
    </section>
  );
};

export default Hero;

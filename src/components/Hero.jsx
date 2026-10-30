import React from 'react';
import AutoPlayVideo from './AutoPlayVideo';
import Saison from './Saison';
import { useLanguage } from '../i18n/LanguageContext';
import { saisonCourante } from '../services/saison';

// Le bouton vers son article Marie Claire (« So You, la marque de cosmétique
// naturel made in Genève »). Vide, le bouton se cache : rien de cassé ne part
// en ligne si l'article venait à disparaître et qu'on retirait l'adresse.
const MARIE_CLAIRE_URL = 'https://www.marieclaire.fr/adresses-incontournables/so-you-le-cosmetique-naturel-made-in-geneve/';

// Composition follows the mockup she supplied: the wordmark leads, the promise
// sits under it, then a rule, then the two-line nature/science couplet. The
// workshops CTA moved out of the hero at her request — it now lives in the
// workshops section, where the context is.
const Hero = () => {
  const { t } = useLanguage();

  return (
    <section className="relative h-screen w-full flex items-center justify-center overflow-hidden">
      {/* L'affiche est le plus grand element peint de la page — donc la mesure
          que Google appelle LCP. Sans elle, cette mesure attendait le
          telechargement de 2,29 Mo de video : l'accueil restait vide le temps
          que le reseau reponde, et sur une connexion mobile devant la boutique,
          longtemps. Une image de 107 Ko la remplit tout de suite, et la video
          se pose dessus quand elle arrive. */}
      <AutoPlayVideo
        src="/hero-video.mp4"
        poster="/hero-poster.jpg"
        className="absolute inset-0 z-0 w-full h-full object-cover sepia-[.04] saturate-[.92] brightness-105
                   motion-safe:animate-[heroDrift_28s_ease-in-out_infinite]"
      />

      {/* Warm grade. The vignette is softer than before so the travertine tones
          in the footage survive instead of being crushed to grey at the edges. */}
      <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(58,51,43,0.08) 0%, rgba(58,51,43,0.06) 45%, rgba(58,51,43,0.42) 100%)' }} />
      <div className="absolute inset-0 z-10 bg-[#B9A891]/[0.10] mix-blend-soft-light" />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/35 via-transparent to-black/25" />

      {/* L'habillage saisonnier, s'il est activé. Posé après le dégradé et
          avant le texte : la neige passe devant l'image et derrière le titre,
          ce qui donne la profondeur. Rend null hors saison — le bandeau
          d'origine est alors intact, au pixel près. */}
      <Saison saison={saisonCourante()} />

      <div className="relative z-20 text-center px-5 max-w-3xl mx-auto flex flex-col items-center mt-14 sm:mt-16">
        {/* Le titre principal de la page, pour Google : le nom, et ce qu'elle
            fait. La promesse en dessous restait le seul <h1> — « La beauté,
            pensée. À savourer. » — sans un mot de ce que la boutique vend ni
            d'où. La ligne descriptive est visible, en petites capitales sous
            le nom ; elle se réécrit dans « Textes du site ». */}
        <h1
          className="flex flex-col items-center mb-5 sm:mb-7
                     opacity-0 animate-[fadeIn_0.55s_cubic-bezier(0.16,1,0.3,1)_forwards]"
        >
          <span
            className="font-serif text-ivory text-5xl sm:text-6xl md:text-7xl"
            style={{ letterSpacing: '-0.02em', textShadow: '0 2px 24px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.28)' }}
          >
            {t('hero.brand')}
          </span>
          <span
            className="mt-3 font-sans text-ivory/85 text-[10px] sm:text-xs uppercase tracking-[0.28em]"
            style={{ textShadow: '0 1px 10px rgba(0,0,0,0.45)' }}
          >
            {t('hero.h1Detail')}
          </span>
        </h1>

        {/* The promise */}
        <p
          className="font-serif font-light text-ivory text-[1.375rem]/[1.24] sm:text-3xl md:text-[2.6rem]/[1.12] max-w-2xl
                     opacity-0 animate-[fadeInUp_0.55s_cubic-bezier(0.16,1,0.3,1)_0.08s_forwards]"
          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.45), 0 1px 6px rgba(0,0,0,0.25)' }}
        >
          {t('hero.titleLine1')}<br className="hidden sm:block" /> {t('hero.titleLine2')}
        </p>

        {/* Hairline — the divider she drew between the two thoughts */}
        <span
          className="block h-px w-14 sm:w-20 bg-ivory/45 my-6 sm:my-8 origin-center
                     opacity-0 animate-[fadeIn_0.55s_ease-out_0.16s_forwards]"
        />

        {/* Nature / science couplet */}
        <p
          className="font-sans font-light text-ivory/85 text-[0.8125rem] sm:text-base leading-relaxed
                     opacity-0 animate-[fadeInUp_0.55s_cubic-bezier(0.16,1,0.3,1)_0.24s_forwards]"
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.38)' }}
        >
          {t('hero.subtitleLine1')}<br />{t('hero.subtitleLine2')}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-9 sm:mt-11 w-full sm:w-auto px-2 sm:px-0
                        opacity-0 animate-[fadeInUp_0.55s_cubic-bezier(0.16,1,0.3,1)_0.32s_forwards]">
          <a
            href="#products"
            className="px-8 sm:px-10 py-3.5 sm:py-4 bg-ivory text-slate-stone font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs
                       hover:bg-ivory/90 shadow-lg rounded-full text-center press"
          >
            {t('hero.cta1')}
          </a>
          {MARIE_CLAIRE_URL && (
            <a
              href={MARIE_CLAIRE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 sm:px-10 py-3.5 sm:py-4 border border-ivory/45 text-ivory font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs
                         hover:bg-ivory/10 hover:border-ivory/70 backdrop-blur-sm rounded-full text-center press"
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

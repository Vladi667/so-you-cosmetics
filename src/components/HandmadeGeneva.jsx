import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// The philosophy banner, following the reference the client supplied: a quiet
// statement on plaster, above a band of botanical detail shots.
//
// It replaces the "100% fait main à Genève" video block — that footage moves to
// the Notre-histoire page, where she asked for it.
//
// The four frames are staged from photography she already owns. Each drifts on
// its own slow cycle so the band breathes without anything visibly moving; the
// offsets are deliberately co-prime so they never fall into step.
const FRAMES = [
  { src: '/botanical_flatlay.png',        alt: '',              delay: '0s',    duration: '26s' },
  { src: '/artisanal_soap_crafting.png',  alt: '',              delay: '-7s',   duration: '31s' },
  { src: '/workshop_ingredients.png',     alt: '',              delay: '-13s',  duration: '29s' },
  { src: '/premium_product_stone.png',    alt: '',              delay: '-19s',  duration: '34s' },
];

const HandmadeGeneva = () => {
  const { t } = useLanguage();
  const icons = [
    (
      <svg viewBox="0 0 32 32" className="w-8 h-8" aria-hidden="true">
        <rect width="32" height="32" rx="4" fill="#FF0000" />
        <rect x="13" y="6" width="6" height="20" rx="1" fill="white" />
        <rect x="6" y="13" width="20" height="6" rx="1" fill="white" />
      </svg>
    ),
    <span className="text-3xl" aria-hidden="true">🌿</span>,
    <span className="text-3xl" aria-hidden="true">✨</span>,
  ];
  const pillars = t('handmade.pillars').map((p, i) => ({ ...p, icon: icons[i] }));

  return (
    <section className="relative bg-mist-white">
      {/* Statement */}
      <div className="container mx-auto px-6 md:px-12 pt-20 md:pt-28 pb-10 md:pb-14">
        <div className="max-w-3xl mx-auto text-center reveal">
          <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-stone-gray/70 mb-6">
            {t('handmade.eyebrow')}
          </p>
          <h2 className="leading-[1.14] font-serif font-light text-slate-stone text-2xl sm:text-4xl md:text-[2.9rem]">
            {t('handmade.titleLine1')}<br className="hidden sm:block" /> {t('handmade.titleLine2')}
          </h2>
          <p className="font-sans font-light text-stone-gray/85 text-sm sm:text-base leading-relaxed mt-6 max-w-2xl mx-auto">
            {t('handmade.lead')}
          </p>
        </div>
      </div>

      {/* Botanical band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-alpine-silver/60">
        {FRAMES.map((frame, i) => (
          <div key={i} className="relative aspect-[3/4] sm:aspect-[4/5] overflow-hidden bg-lake-mist reveal"
               style={{ transitionDelay: `${i * 90}ms` }}>
            <img
              src={frame.src}
              alt={frame.alt}
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover brightness-[1.06] saturate-[0.95]
                         motion-safe:animate-[frameDrift_var(--dur)_ease-in-out_infinite]"
              style={{ '--dur': frame.duration, animationDelay: frame.delay }}
            />
            {/* Warm unifying wash so four different shoots read as one band */}
            <div className="absolute inset-0 bg-[#B9A891]/[0.14] mix-blend-soft-light pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Pillars */}
      <div className="relative z-20 -mt-14 md:-mt-20 pb-16 md:pb-20">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
            {pillars.map((pillar, index) => (
              <div
                key={index}
                className="group bg-ivory rounded-[24px] md:rounded-[30px] p-6 md:p-10 shadow-[0_20px_60px_rgba(58,51,43,0.10)] hover:shadow-[0_30px_80px_rgba(58,51,43,0.15)] hover:-translate-y-2 transition-all duration-250 reveal border border-slate-stone/5 text-center"
                style={{ transitionDelay: `${index * 90}ms` }}
              >
                <div className="w-14 h-14 md:w-16 md:h-16 bg-mist-white rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:scale-105 transition-transform duration-250">
                  {pillar.icon}
                </div>
                <h3 className="font-serif text-xl md:text-2xl text-slate-stone mb-3 md:mb-4">
                  {pillar.title}
                </h3>
                <p className="font-sans font-light text-stone-gray leading-relaxed text-sm">
                  {pillar.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HandmadeGeneva;

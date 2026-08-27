import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { IconeSimple } from './IconeEngagement';

// The philosophy banner, following the reference the client supplied: a quiet
// statement on plaster, above a band of botanical detail shots.
//
// It replaces the "100% fait main à Genève" video block — that footage moves to
// the Notre-histoire page, where she asked for it.
//
// Trois plans, pris dans les photographies qu'elle possède déjà. Chacun dérive
// sur son propre cycle lent pour que la bande respire sans que rien ne bouge
// visiblement ; les décalages sont premiers entre eux, donc ils ne tombent
// jamais en cadence.
//
// Il y en avait quatre. Le quatrième — un flacon fini posé sur une pierre dans
// une rivière d'hiver — sortait deux fois du rang. Sur la couleur : les trois
// autres ont un écart rouge-bleu de +16 à +21 et une clarté de 170 à 188,
// lui était à -29, dominante bleue, et à 139. Un voile chaud avait été posé
// sur la bande pour rattraper l'écart, mais 14 % ne réchauffent pas une image
// froide, ils la ternissent. Sur le sujet, surtout : les trois autres sont des
// plans d'ingrédients et de fabrication, lui est un produit fini dans un
// paysage — ce n'est pas la même bande.
//
// Trois valent mieux qu'un quatrième mal assorti, et la bande compte
// désormais autant de plans que de piliers en dessous.
const FRAMES = [
  { src: '/botanical_flatlay.png',        alt: '',              delay: '0s',    duration: '26s' },
  { src: '/artisanal_soap_crafting.png',  alt: '',              delay: '-7s',   duration: '31s' },
  { src: '/workshop_ingredients.png',     alt: '',              delay: '-13s',  duration: '29s' },
];

const HandmadeGeneva = () => {
  const { t } = useLanguage();
  // The first card used to carry a Swiss flag, back when it read "Local —
  // Geneva craftsmanship, Swiss ingredients". The copy is now a statement about
  // skin, and the flag would restate an origin claim that was removed from the
  // site this morning precisely because the ingredients are not all Swiss.
  // Au trait plutot qu'en emoji : un emoji est dessine par le systeme, sans la
  // couleur ni le trait de la marque, et change d'aspect d'un appareil a l'autre.
  const icons = [
    <IconeSimple nom="peau" className="w-7 h-7" />,
    <IconeSimple nom="feuille" className="w-7 h-7" />,
    <IconeSimple nom="goutte" className="w-7 h-7" />,
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
          <h2 className=" font-serif font-light text-slate-stone text-2xl sm:text-4xl md:text-[2.9rem]/[1.11]">
            {t('handmade.titleLine1')}<br className="hidden sm:block" /> {t('handmade.titleLine2')}
          </h2>
          <p className="font-sans font-light text-stone-gray/85 text-sm sm:text-base leading-relaxed mt-6 max-w-2xl mx-auto">
            {t('handmade.lead')}
          </p>
        </div>
      </div>

      {/* Botanical band */}
      {/* Trois colonnes à toutes les tailles : en deux colonnes, trois plans
          laissent un orphelin sur la seconde ligne. */}
      <div className="grid grid-cols-3 gap-px bg-alpine-silver/60">
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
                className="group bg-ivory rounded-[24px] md:rounded-[30px] p-6 md:p-10 shadow-[0_20px_60px_rgba(58,51,43,0.10)] hover:shadow-[0_30px_80px_rgba(58,51,43,0.15)] hover:-translate-y-2 transition-[opacity,transform,box-shadow] duration-300 reveal border border-slate-stone/5 text-center"
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

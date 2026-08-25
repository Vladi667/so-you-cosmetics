import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import AutoPlayVideo from '../components/AutoPlayVideo';

const AboutPage = () => {
  const { t } = useLanguage();
  const values = t('about.values');

  return (
    <div className="min-h-screen bg-mist-white overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-stone overflow-hidden">
          {/* The water-and-lavender footage, moved here from the home page at her
              request. Graded brighter with the pebbles pulled towards off-white
              rather than grey: brightness lifts, saturation drops so the stones
              lose their cool cast, and a travertine wash warms what remains. */}
          <AutoPlayVideo
            src="/Water_rippling_over_river_stones_202605070445.mp4"
            className="absolute inset-0 w-full h-full object-cover
                       brightness-[1.22] contrast-[0.94] saturate-[0.72] sepia-[.06]
                       motion-safe:animate-[heroDrift_32s_ease-in-out_infinite]"
          />
          <div className="absolute inset-0 bg-[#B9A891]/[0.16] mix-blend-soft-light"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-stone/45 via-transparent to-slate-stone/35"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center reveal mt-20">
          <p className="text-white/80 uppercase tracking-[0.5em] text-[10px] md:text-xs mb-8 font-sans font-bold">{t('about.eyebrow')}</p>
          <h1 className="leading-[1.06] font-serif text-4xl sm:text-6xl md:text-8xl text-white max-w-6xl mx-auto drop-shadow-2xl">
            {t('about.title')}
          </h1>
          {t('about.quote') && (
            <p className="text-white/90 font-serif italic text-lg sm:text-2xl md:text-3xl mt-8 max-w-3xl mx-auto drop-shadow-lg opacity-80">
              {t('about.quote')}
            </p>
          )}
        </div>
      </section>

      {/* Origin Story - Split Screen with more impact */}
      <section className="py-16 md:py-40 bg-ivory relative">
        <div className="container mx-auto px-6 md:px-12 max-w-7xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 md:gap-24 items-center">
            <div className="reveal">
              <h2 className="leading-[1.1] font-serif text-2xl sm:text-3xl md:text-5xl lg:text-6xl text-slate-stone mb-4 sm:mb-8 md:mb-12">{t('about.s2TitleLine1')}<br/><span className="italic text-slate-stone/40">{t('about.s2TitleLine2')}</span></h2>
              <div className="space-y-3 sm:space-y-6 md:space-y-8 font-sans text-stone-gray font-light leading-relaxed text-sm md:text-lg lg:text-xl text-left sm:text-justify">
                <p className="first-letter:text-3xl sm:first-letter:text-5xl md:first-letter:text-7xl first-letter:font-serif first-letter:text-slate-stone first-letter:mr-2 sm:first-letter:mr-3 first-letter:float-left first-letter:leading-none">
                  {t('about.s2p1')}
                </p>
                <p>
                  {t('about.s2p2')}
                </p>
                <div className="relative py-3 px-3 sm:py-6 sm:px-6 md:py-12 md:px-10 bg-mist-white rounded-xl sm:rounded-2xl md:rounded-3xl border-l-2 sm:border-l-4 md:border-l-8 border-slate-stone shadow-md sm:shadow-xl transform -rotate-1 my-4 sm:my-8 md:my-12">
                  <p className="text-sm md:text-xl lg:text-2xl italic font-serif text-slate-stone leading-relaxed">
                    {t('about.s2quote')}
                  </p>
                </div>
              </div>
            </div>
            <div className="reveal" style={{ transitionDelay: '200ms' }}>
              <div className="relative aspect-[4/5] rounded-[12px] sm:rounded-[24px] md:rounded-[40px] overflow-hidden shadow-2xl">
                <img 
                  src="/botanical_flatlay.png" 
                  alt="Natural Botanical Ingredients" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Turning Point - Parallax Background with more intensity */}
      <section className="relative py-16 sm:py-32 md:py-56 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-slate-stone">
          <img 
            src="/premium_product_stone.png" 
            alt="Premium So You Product" 
            className="w-full h-full object-cover opacity-70 brightness-125 contrast-95 mix-blend-overlay fixed-background scale-110"
          />
          <div className="absolute inset-0 bg-slate-stone/25"></div>
        </div>
        <div className="relative z-10 container mx-auto px-4 sm:px-6 md:px-12 max-w-5xl text-center reveal">
          <div className="bg-white/5 backdrop-blur-xl p-5 sm:p-12 md:p-20 rounded-[20px] sm:rounded-[30px] md:rounded-[40px] border border-white/20 shadow-2xl overflow-hidden relative group">
            {/* Animated decorative lines */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            
            <h2 className="leading-[1.1] font-serif text-2xl sm:text-5xl md:text-7xl text-white mb-6 sm:mb-12 drop-shadow-lg">{t('about.tpTitle')}</h2>
            <div className="space-y-4 sm:space-y-8 md:space-y-10 font-sans text-white/90 font-light leading-relaxed text-xs sm:text-lg md:text-xl lg:text-2xl">
              <p className="reveal">
                {t('about.tpp1')}
              </p>
              <p className="reveal" style={{ transitionDelay: '100ms' }}>
                {t('about.tpp2')}
              </p>
              <div className="w-24 h-[1px] bg-white/40 mx-auto my-4 sm:my-8 md:my-12"></div>
              <p className="font-serif italic text-sm sm:text-2xl md:text-3xl lg:text-4xl text-white drop-shadow-xl reveal" style={{ transitionDelay: '200ms' }}>
                {t('about.tpQuotePrefix')}<span className="font-sans font-bold not-italic">{t('about.tpQuoteBrand')}</span>{t('about.tpQuoteSuffix')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The 6 Values Grid - Even more percutant */}
      <section className="py-16 sm:py-28 md:py-40 bg-gradient-to-b from-mist-white to-white relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-20 md:mb-32 reveal">
            <h2 className="leading-[1.1] font-serif text-3xl sm:text-5xl md:text-7xl text-slate-stone mb-4 sm:mb-10">{t('about.valuesTitle')}</h2>
            <p className="font-sans font-light text-stone-gray text-sm sm:text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed">
              {t('about.valuesIntro')}
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-8 lg:gap-16">
            {values.map((value, index) => (
              <div 
                key={index} 
                className="group relative bg-ivory rounded-[16px] sm:rounded-[30px] md:rounded-[40px] p-3 sm:p-8 md:p-12 shadow-[0_15px_50px_rgb(0,0,0,0.05)] hover:shadow-[0_30px_70px_rgb(0,0,0,0.1)] transform hover:-translate-y-4 transition-all duration-700 reveal overflow-hidden border border-slate-stone/5"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="absolute -right-2 -bottom-4 sm:-right-4 sm:-bottom-8 md:-right-6 md:-bottom-10 text-[4.5rem] sm:text-[8rem] md:text-[12rem] font-serif text-slate-stone/[0.04] group-hover:text-slate-stone/[0.08] group-hover:scale-125 transition-all duration-700 pointer-events-none italic">
                  {index + 1}
                </div>
                
                <div className="relative z-10">
                  <div className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-mist-white rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 md:mb-10 group-hover:bg-slate-stone group-hover:text-white transition-all duration-250 transform group-hover:rotate-12">
                    <span className="font-serif text-xs sm:text-lg md:text-2xl font-bold">0{index + 1}</span>
                  </div>
                  <h3 className="font-sans tracking-[0.1em] sm:tracking-[0.2em] uppercase text-[9px] sm:text-xs md:text-sm mb-2 sm:mb-4 md:mb-6 font-bold text-slate-stone">
                    {value.title}
                  </h3>
                  <p className="font-sans font-light text-stone-gray leading-relaxed text-[11px] sm:text-sm md:text-base lg:text-lg">
                    {value.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promise / Footer */}
      <section className="py-16 sm:py-32 bg-ivory text-center border-t border-mist-white">
        <div className="container mx-auto px-6 md:px-12 max-w-4xl reveal">
          <h2 className="leading-[1.1] font-serif text-2xl sm:text-4xl text-slate-stone mb-6 sm:mb-10">{t('about.promiseTitle')}</h2>
          <p className="font-sans text-stone-gray font-light leading-relaxed text-sm sm:text-xl mb-8 sm:mb-16">
            {t('about.promiseText')}
          </p>
          <div className="w-16 h-[1px] bg-slate-stone/20 mx-auto mb-8 sm:mb-16"></div>
          <p className="font-serif italic text-lg sm:text-4xl text-slate-stone leading-relaxed px-2 sm:px-8">
            {t('about.promiseQuote')}
          </p>
          
          <div className="mt-10 sm:mt-20">
            <div className="font-serif text-slate-stone italic text-4xl sm:text-6xl opacity-90 -rotate-2">
              So You
            </div>
            <p className="text-xs sm:text-sm uppercase tracking-[0.4em] text-stone-gray mt-3 sm:mt-6">
              {t('about.founder')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;

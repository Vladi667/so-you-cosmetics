import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const Ingredients = () => {
  const { t } = useLanguage();
  const icons = ['🌴', '🧴', '♻️', '🌱'];
  const commitments = t('ingredients.commitments').map((c, i) => ({ ...c, icon: icons[i] }));

  return (
    <section className="py-24 md:py-40 bg-mist-white relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-green-50/40 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-50/30 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2"></div>

      <div className="container mx-auto px-6 md:px-12 relative z-10">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-24 reveal">
          <p className="font-sans text-[10px] tracking-[0.5em] uppercase text-stone-gray/40 mb-6 font-bold">{t('ingredients.eyebrow')}</p>
          <h2 className="font-serif text-4xl md:text-7xl text-slate-stone mb-8 md:mb-10 leading-tight">
            {t('ingredients.titleLine1')}<br/><span className="italic text-slate-stone/40 font-light">{t('ingredients.titleLine2')}</span>
          </h2>
          <p className="font-sans font-light text-stone-gray text-lg md:text-xl leading-relaxed">
            {t('ingredients.intro')}
          </p>
        </div>

        {/* 4 Commitment Cards — 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8 max-w-4xl mx-auto">
          {commitments.map((item, index) => (
            <div
              key={index}
              className="group flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3 sm:gap-6 bg-white rounded-[20px] sm:rounded-[30px] p-4 sm:p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.1)] hover:-translate-y-2 transition-all duration-700 reveal border border-slate-stone/5"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-mist-white rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 text-lg sm:text-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                {item.icon}
              </div>
              <div>
                <h3 className="font-sans tracking-[0.1em] sm:tracking-[0.15em] uppercase text-[10px] sm:text-xs md:text-sm font-bold text-slate-stone mb-1.5 sm:mb-3">
                  {item.title}
                </h3>
                <p className="font-sans font-light text-stone-gray leading-relaxed text-[11px] sm:text-xs md:text-[15px]">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Le saviez-vous callout */}
        <div className="max-w-3xl mx-auto mt-16 reveal">
          <div className="bg-white rounded-[30px] p-10 md:p-12 border border-slate-stone/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
            <p className="font-sans text-xs tracking-[0.3em] uppercase text-slate-stone/40 font-bold mb-4">{t('ingredients.didYouKnowLabel')}</p>
            <p className="font-serif text-xl md:text-2xl text-slate-stone leading-relaxed italic">
              {t('ingredients.didYouKnowText')}
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Ingredients;

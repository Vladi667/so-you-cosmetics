import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

const BrandEssence = () => {
  const { t } = useLanguage();
  const marqueeText = t('brandEssence.marquee');

  return (
    <section className="bg-ivory overflow-hidden">
      
      {/* Scrolling Marquee */}
      <div className="py-8 border-y border-slate-stone/5 overflow-hidden bg-mist-white/30">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...Array(8)].map((_, i) => (
            <span 
              key={i} 
              className="font-sans text-xs font-semibold tracking-[0.5em] uppercase text-slate-stone pr-8"
            >
              {marqueeText}
            </span>
          ))}
        </div>
      </div>

    </section>
  );
};

export default BrandEssence;

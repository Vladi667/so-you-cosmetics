import React from 'react';

const BrandEssence = () => {
  const marqueeText = "PURETÉ SUISSE & SAVOIR-FAIRE ARTISANAL • ZÉRO COMPROMIS SUR LA QUALITÉ • COSMÉTIQUE 100% NATURELLE • ";

  return (
    <section className="bg-white overflow-hidden">
      
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

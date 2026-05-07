import React from 'react';
import AutoPlayVideo from './AutoPlayVideo';

const HandmadeGeneva = () => {
  const pillars = [
    {
      icon: (
        <svg viewBox="0 0 32 32" className="w-8 h-8">
          <rect width="32" height="32" rx="4" fill="#FF0000"/>
          <rect x="13" y="6" width="6" height="20" rx="1" fill="white"/>
          <rect x="6" y="13" width="20" height="6" rx="1" fill="white"/>
        </svg>
      ),
      title: "Local",
      text: "Artisanal genevois, ingrédients suisses, parfums de Grasse.",
    },
    {
      icon: <span className="text-3xl">🌿</span>,
      title: "Écologique",
      text: "Végétal, RSPO, vegan-friendly, emballages recyclables.",
    },
    {
      icon: <span className="text-3xl">✨</span>,
      title: "Bon",
      text: "Zéro parabènes, sulfates, silicones ou graisses animales.",
    },
  ];

  return (
    <section className="relative">
      {/* Video Section */}
      <div className="relative h-[50vh] md:h-[70vh] overflow-hidden">
        <AutoPlayVideo
          src="/Water_rippling_over_river_stones_202605070445.mp4"
          className="absolute inset-0 w-full h-full object-cover sepia-[.03]"
        />

        {/* Same filter stack as hero — exact match */}
        <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)' }}></div>
        <div className="absolute inset-0 z-10 bg-amber-900/[0.04]"></div>
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/40 via-transparent to-black/40"></div>

        {/* Title */}
        <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-6 reveal">
          <p className="font-sans text-[10px] tracking-[0.5em] uppercase text-white/50 mb-6 font-bold" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2)' }}>Notre Philosophie</p>
          <h2 className="font-serif text-4xl md:text-8xl text-white leading-tight" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
            100% Handmade<br/>
            <span className="italic font-light opacity-80">in Geneva</span>
          </h2>
        </div>
      </div>

      {/* Overlapping Pillar Cards */}
      <div className="relative z-20 -mt-16 md:-mt-20 pb-16 md:pb-20">
        <div className="container mx-auto px-4 sm:px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 max-w-5xl mx-auto">
            {pillars.map((pillar, index) => (
              <div
                key={index}
                className="group bg-white rounded-[24px] md:rounded-[30px] p-6 md:p-10 shadow-[0_20px_60px_rgb(0,0,0,0.1)] hover:shadow-[0_30px_80px_rgb(0,0,0,0.15)] hover:-translate-y-3 transition-all duration-700 reveal border border-slate-stone/5 text-center"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 md:w-16 md:h-16 bg-mist-white rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
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

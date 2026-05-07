import React from 'react';

const Workshops = () => {
  return (
    <section id="workshops" className="relative py-48 flex items-center justify-center overflow-hidden">
      
      {/* Full-width video background */}
      <video
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover sepia-[.03]"
      >
        <source src="/workshop.mp4" type="video/mp4" />
      </video>

      {/* Same filter stack as the hero */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.5) 100%)' }}></div>
      <div className="absolute inset-0 bg-amber-900/[0.04]"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40"></div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center">
        <p className="font-sans text-[10px] tracking-[0.5em] uppercase text-white/60 mb-8 font-bold">Expérience So You</p>
        <h2 className="font-serif text-5xl md:text-7xl text-white mb-8 tracking-wide" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
          Nos Ateliers Artisanaux
        </h2>
        
        <p className="font-sans text-white/85 text-lg md:text-xl mb-16 leading-relaxed font-light max-w-2xl mx-auto" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4), 0 1px 4px rgba(0,0,0,0.2)' }}>
          Apprenez l'art de la cosmétique naturelle lors d'ateliers intimistes dans notre atelier genevois. Chacun repart avec sa propre création.
        </p>

        <div className="flex flex-col sm:flex-row gap-5 justify-center">
          <a href="/workshops" className="inline-block px-10 py-4 bg-white text-slate-stone font-sans uppercase tracking-[0.3em] text-xs hover:bg-slate-stone hover:text-white transition-all duration-500 rounded-full shadow-xl hover:scale-105 transform">
            Découvrir
          </a>
          <a href="/contact" className="inline-block px-10 py-4 border border-white/40 text-white font-sans uppercase tracking-[0.3em] text-xs hover:bg-white/10 hover:border-white transition-all duration-500 rounded-full backdrop-blur-sm">
            Réserver
          </a>
        </div>
      </div>
    </section>
  );
};

export default Workshops;

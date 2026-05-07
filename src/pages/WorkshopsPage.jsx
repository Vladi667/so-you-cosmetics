import React, { useEffect } from 'react';
import AutoPlayVideo from '../components/AutoPlayVideo';

const WorkshopsPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    const hiddenElements = document.querySelectorAll('.reveal');
    hiddenElements.forEach((el) => observer.observe(el));

    return () => {
      hiddenElements.forEach((el) => observer.unobserve(el));
    };
  }, []);

  const details = [
    { label: "Format", value: "One-to-one ou 2 personnes maximum" },
    { label: "Tarifs", value: "CHF 150 — CHF 450 par personne" },
    { label: "Durée", value: "2 à 6 heures selon l'atelier choisi" },
    { label: "Jours", value: "Samedis, ou exceptionnellement dimanches" },
  ];

  return (
    <div className="min-h-screen bg-mist-white overflow-hidden">

      {/* Hero Section */}
      <section className="relative h-[70vh] md:h-[85vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-stone overflow-hidden">
          <AutoPlayVideo
            src="/workshop.mp4"
            className="w-full h-full object-cover opacity-70 mix-blend-overlay scale-105 sepia-[.03]"
          />
          {/* Vignette */}
          <div className="absolute inset-0 z-10" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.45) 100%)' }}></div>
          {/* Warm amber whisper */}
          <div className="absolute inset-0 z-10 bg-amber-900/[0.04]"></div>
          {/* Top/bottom gradient */}
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-slate-stone/70 via-transparent to-slate-stone/60"></div>
        </div>
        <div className="relative z-20 container mx-auto px-6 text-center reveal mt-20">
          <p className="text-white/80 uppercase tracking-[0.5em] text-[10px] md:text-xs mb-6 md:mb-8 font-sans font-bold">Expérience Artisanale</p>
          <h1 className="font-serif text-4xl sm:text-6xl md:text-8xl text-white leading-tight max-w-5xl mx-auto" style={{ textShadow: '0 2px 20px rgba(0,0,0,0.5), 0 1px 6px rgba(0,0,0,0.3)' }}>
            Nos Ateliers
          </h1>
          <p className="text-white/90 font-serif italic text-xl md:text-3xl mt-6 md:mt-8 max-w-3xl mx-auto opacity-80" style={{ textShadow: '0 1px 12px rgba(0,0,0,0.4)' }}>
            "Créez vos propres cosmétiques naturels"
          </p>
        </div>
      </section>

      {/* Introduction — The pitch */}
      <section className="py-16 md:py-32 bg-white relative">
        <div className="container mx-auto px-6 md:px-12 max-w-5xl">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20 items-center">
            <div className="w-full lg:w-1/2 reveal">
              <h2 className="font-serif text-4xl md:text-6xl text-slate-stone mb-8 md:mb-12 leading-tight">
                L'Art de la<br/><span className="italic text-slate-stone/40">Fabrication</span>
              </h2>
              <div className="space-y-6 md:space-y-8 font-sans text-stone-gray font-light leading-relaxed text-lg md:text-xl text-justify">
                <p className="first-letter:text-5xl md:first-letter:text-7xl first-letter:font-serif first-letter:text-slate-stone first-letter:mr-3 first-letter:float-left first-letter:leading-none">
                  Les ateliers sont dispensés sur demande, les samedis ou exceptionnellement les dimanches. Ils sont également personnalisables selon les besoins de chacun.
                </p>
                <div className="relative py-8 md:py-10 px-8 md:px-10 bg-mist-white rounded-3xl border-l-8 border-slate-stone shadow-xl transform -rotate-1 my-8 md:my-10">
                  <p className="text-xl md:text-2xl italic font-serif text-slate-stone leading-relaxed">
                    "Chacun repart avec sa propre fabrication."
                  </p>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/2 reveal" style={{ transitionDelay: '200ms' }}>
              <div className="relative aspect-[4/5] rounded-[30px] md:rounded-[40px] overflow-hidden shadow-2xl">
                <img
                  src="/workshop_ingredients.png"
                  alt="Ingrédients Naturels"
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Details — Bento Cards */}
      <section className="py-16 md:py-32 bg-gradient-to-b from-mist-white to-white relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-blue-100/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-16 md:mb-24 reveal">
            <h2 className="font-serif text-4xl md:text-7xl text-slate-stone mb-6 md:mb-10">Les Détails</h2>
            <p className="font-sans font-light text-stone-gray text-lg md:text-2xl max-w-3xl mx-auto leading-relaxed">
              Un moment privilégié de création, rien que pour vous.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 lg:gap-16 max-w-4xl mx-auto">
            {details.map((item, index) => (
              <div
                key={index}
                className="group relative bg-white rounded-[30px] md:rounded-[40px] p-8 md:p-12 shadow-[0_15px_50px_rgb(0,0,0,0.05)] hover:shadow-[0_30px_70px_rgb(0,0,0,0.1)] transform hover:-translate-y-4 transition-all duration-700 reveal overflow-hidden border border-slate-stone/5"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="absolute -right-6 -bottom-10 text-[8rem] md:text-[12rem] font-serif text-slate-stone/[0.04] group-hover:text-slate-stone/[0.08] group-hover:scale-125 transition-all duration-1000 pointer-events-none italic">
                  {index + 1}
                </div>
                <div className="relative z-10">
                  <div className="w-14 h-14 md:w-16 md:h-16 bg-mist-white rounded-2xl flex items-center justify-center mb-6 md:mb-10 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500 transform group-hover:rotate-12">
                    <span className="font-serif text-xl md:text-2xl font-bold">0{index + 1}</span>
                  </div>
                  <h3 className="font-sans tracking-[0.2em] uppercase text-sm mb-3 md:mb-4 font-bold text-slate-stone">
                    {item.label}
                  </h3>
                  <p className="font-serif text-xl md:text-2xl text-slate-stone/80 leading-relaxed">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — Contact Section */}
      <section className="relative py-24 md:py-48 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-slate-stone">
          <img
            src="/workshop_crafting.png"
            alt="Atelier Background"
            className="w-full h-full object-cover opacity-30 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-slate-stone/50"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center reveal">
          <h2 className="font-serif text-4xl md:text-7xl text-white mb-8 md:mb-10 drop-shadow-lg">Réservez Votre Atelier</h2>
          <p className="font-sans text-white/80 text-lg md:text-2xl font-light mb-10 md:mb-16 max-w-2xl mx-auto leading-relaxed">
            Contactez-nous pour de plus amples renseignements et réservez votre moment de création.
          </p>
          <a
            href="mailto:contact@soyou.ch"
            className="inline-block px-10 md:px-12 py-4 md:py-5 bg-white text-slate-stone font-sans uppercase tracking-[0.3em] text-xs sm:text-sm hover:bg-slate-stone hover:text-white transition-all duration-500 shadow-xl rounded-full hover:scale-105 transform"
          >
            Nous Contacter
          </a>
        </div>
      </section>
    </div>
  );
};

export default WorkshopsPage;

import React, { useEffect } from 'react';

const AboutPage = () => {
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

  const values = [
    { title: "Hydratation & Bien-être", text: "Qui aident notre peau à être naturellement hydratée et de se sentir bien." },
    { title: "100% Naturel", text: "Exempts de conservateurs et autres ingrédients chimiques indésirables." },
    { title: "Éco-Responsable", text: "Dont la fabrication et l'utilisation sont respectueuses de l'environnement et de la biodiversité." },
    { title: "Zéro Déchet", text: "Dont l'emballage est minimaliste et entièrement recyclable." },
    { title: "Cruelty Free", text: "Qui ne sont pas testés sur les animaux et ne contiennent aucune graisse animale." },
    { title: "Sans Pétrochimie", text: "Qui ne contiennent absolument aucune graisse issue de la pétrochimie." }
  ];

  return (
    <div className="min-h-screen bg-mist-white overflow-hidden">
      
      {/* Hero Section */}
      <section className="relative h-[85vh] flex items-center justify-center">
        <div className="absolute inset-0 bg-slate-stone overflow-hidden">
          <img 
            src="/artisanal_soap_crafting.png" 
            alt="Artisanal Soap Crafting Studio" 
            className="w-full h-full object-cover opacity-60 mix-blend-overlay scale-110 animate-[float_20s_ease-in-out_infinite]"
          />
          {/* Top gradient for Navbar visibility, bottom gradient for transition */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-stone/80 via-transparent to-slate-stone/60"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 text-center reveal mt-20">
          <p className="text-white/80 uppercase tracking-[0.5em] text-[10px] md:text-xs mb-8 font-sans font-bold">L'Art de la Cosmétique Naturelle</p>
          <h1 className="font-serif text-6xl md:text-8xl text-white leading-tight max-w-6xl mx-auto drop-shadow-2xl">
            So You, créateur de beauté au naturel
          </h1>
          <p className="text-white/90 font-serif italic text-2xl md:text-3xl mt-8 max-w-3xl mx-auto drop-shadow-lg opacity-80">
            "Les cosmétiques qui vous ressemblent"
          </p>
        </div>
      </section>

      {/* Origin Story - Split Screen with more impact */}
      <section className="py-40 bg-white relative">
        <div className="container mx-auto px-6 md:px-12 max-w-7xl">
          <div className="flex flex-col lg:flex-row gap-24 items-center">
            <div className="w-full lg:w-1/2 reveal">
              <h2 className="font-serif text-5xl md:text-6xl text-slate-stone mb-12 leading-tight">Une Révolution dans<br/><span className="italic text-slate-stone/40">votre salle de bain</span></h2>
              <div className="space-y-8 font-sans text-stone-gray font-light leading-relaxed text-xl text-justify">
                <p className="first-letter:text-7xl first-letter:font-serif first-letter:text-slate-stone first-letter:mr-3 first-letter:float-left first-letter:leading-none">
                  Dès le réveil, nous sommes tous en contact avec des produits cosmétiques tels que le dentifrice, le savon, le shampoing, ainsi que les crèmes, lotions, gels, sérums de toutes sortes. 
                </p>
                <p>
                  Et en plus pour les femmes : maquillage, vernis à ongles, teintures pour cheveux etc... Dès lors, il est important de se procurer des cosmétiques naturels aussi sains que possible, non seulement pour notre bien-être, mais également pour préserver la nature.
                </p>
                <div className="relative py-12 px-10 bg-mist-white rounded-3xl border-l-8 border-slate-stone shadow-xl transform -rotate-1 my-12">
                  <p className="text-2xl italic font-serif text-slate-stone leading-relaxed">
                    "Comme il est difficile et rare de se procurer des produits naturels de qualité ayant également une texture et une senteur qui conviennent, j'ai décidé de les fabriquer directement par moi-même."
                  </p>
                </div>
              </div>
            </div>
            <div className="w-full md:w-1/2 reveal" style={{ transitionDelay: '200ms' }}>
              <div className="relative aspect-[4/5] rounded-[40px] overflow-hidden shadow-2xl">
                <img 
                  src="/botanical_flatlay.png" 
                  alt="Natural Botanical Ingredients" 
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-1000"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Turning Point - Parallax Background with more intensity */}
      <section className="relative py-56 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-slate-stone">
          <img 
            src="/premium_product_stone.png" 
            alt="Premium So You Product" 
            className="w-full h-full object-cover opacity-50 mix-blend-overlay fixed-background scale-110"
          />
          <div className="absolute inset-0 bg-slate-stone/40"></div>
        </div>
        <div className="relative z-10 container mx-auto px-6 md:px-12 max-w-5xl text-center reveal">
          <div className="bg-white/5 backdrop-blur-xl p-12 md:p-20 rounded-[40px] border border-white/20 shadow-2xl overflow-hidden relative group">
            {/* Animated decorative lines */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
            
            <h2 className="font-serif text-5xl md:text-7xl text-white mb-12 drop-shadow-lg">De la passion à la création</h2>
            <div className="space-y-10 font-sans text-white/90 font-light leading-relaxed text-xl md:text-2xl">
              <p className="reveal">
                Pour cela, j'ai fini par suivre plusieurs formations professionnelles auprès d'un établissement de renom en Suisse. Ces formations m'ont permis de fabriquer des savons solides et liquides ainsi que des cosmétiques naturels.
              </p>
              <p className="reveal" style={{ transitionDelay: '100ms' }}>
                Avec le temps, convaincue par les effets et la qualité des produits sur la peau, j'ai été enthousiasmée par l'idée de les partager avec le grand public. 
              </p>
              <div className="w-24 h-[1px] bg-white/40 mx-auto my-12"></div>
              <p className="font-serif italic text-3xl md:text-4xl text-white drop-shadow-xl reveal" style={{ transitionDelay: '200ms' }}>
                "Changement de cap : après 20 ans dans le négoce international, la marque <span className="font-sans font-bold not-italic">So You</span> est née."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The 6 Values Grid - Even more percutant */}
      <section className="py-40 bg-gradient-to-b from-mist-white to-white relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-96 h-96 bg-blue-100/30 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
        
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="text-center max-w-4xl mx-auto mb-32 reveal">
            <h2 className="font-serif text-6xl md:text-7xl text-slate-stone mb-10">Nos Engagements</h2>
            <p className="font-sans font-light text-stone-gray text-2xl max-w-3xl mx-auto leading-relaxed">
              Nous offrons à nos clients la possibilité d'utiliser quotidiennement des cosmétiques naturels sains et de qualité :
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-16">
            {values.map((value, index) => (
              <div 
                key={index} 
                className="group relative bg-white rounded-[40px] p-12 shadow-[0_15px_50px_rgb(0,0,0,0.05)] hover:shadow-[0_30px_70px_rgb(0,0,0,0.1)] transform hover:-translate-y-4 transition-all duration-700 reveal overflow-hidden border border-slate-stone/5"
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="absolute -right-6 -bottom-10 text-[12rem] font-serif text-slate-stone/[0.04] group-hover:text-slate-stone/[0.08] group-hover:scale-125 transition-all duration-1000 pointer-events-none italic">
                  {index + 1}
                </div>
                
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-mist-white rounded-2xl flex items-center justify-center mb-10 group-hover:bg-slate-stone group-hover:text-white transition-all duration-500 transform group-hover:rotate-12">
                    <span className="font-serif text-2xl font-bold">0{index + 1}</span>
                  </div>
                  <h3 className="font-sans tracking-[0.2em] uppercase text-sm mb-6 font-bold text-slate-stone">
                    {value.title}
                  </h3>
                  <p className="font-sans font-light text-stone-gray leading-relaxed text-lg">
                    {value.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Promise / Footer */}
      <section className="py-32 bg-white text-center border-t border-mist-white">
        <div className="container mx-auto px-6 md:px-12 max-w-4xl reveal">
          <h2 className="font-serif text-4xl text-slate-stone mb-10">Une entreprise à taille humaine</h2>
          <p className="font-sans text-stone-gray font-light leading-relaxed text-xl mb-16">
            So You est une jeune entreprise de proximité. De par sa taille humaine, elle est à la fois proche et à l'écoute de ses clients. Les demandes spécifiques et conseils des clients sont pris en compte et lorsque cela est possible, nous nous adaptons pour les satisfaire.
          </p>
          <div className="w-16 h-[1px] bg-slate-stone/20 mx-auto mb-16"></div>
          <p className="font-serif italic text-4xl text-slate-stone leading-relaxed px-8">
            "So You vous remercie pour votre confiance, votre soutien, votre gentillesse et vos conseils constructifs."
          </p>
          
          <div className="mt-20">
            <div className="font-serif text-slate-stone italic text-6xl opacity-90 -rotate-2">
              So You
            </div>
            <p className="text-sm uppercase tracking-[0.4em] text-stone-gray mt-6">
              La Fondatrice
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;

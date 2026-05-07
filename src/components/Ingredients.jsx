import React from 'react';

const Ingredients = () => {
  const commitments = [
    {
      icon: "🌴",
      title: "Huile de Palme RSPO",
      text: "Garantie sans déforestation, soutenant les petits producteurs durables.",
    },
    {
      icon: "🧴",
      title: "Alternatives Sans Palme",
      text: "Des gammes sans huile de palme, colorants ou parfums pour chaque sensibilité.",
    },
    {
      icon: "♻️",
      title: "Zéro Déchet Toxique",
      text: "Emballages recyclables, rechargeables ou biodégradables. Packaging minimal.",
    },
    {
      icon: "🌱",
      title: "Saponification à Froid",
      text: "Aucune émission de gaz, fumée ou déchets toxiques pour l'environnement.",
    },
  ];

  return (
    <section className="py-40 bg-mist-white relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-green-50/40 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-50/30 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2"></div>

      <div className="container mx-auto px-6 md:px-12 relative z-10">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-24 reveal">
          <p className="font-sans text-[10px] tracking-[0.5em] uppercase text-stone-gray/40 mb-6 font-bold">Notre Engagement</p>
          <h2 className="font-serif text-5xl md:text-7xl text-slate-stone mb-10 leading-tight">
            Entreprise<br/><span className="italic text-slate-stone/40 font-light">Responsable</span>
          </h2>
          <p className="font-sans font-light text-stone-gray text-xl leading-relaxed">
            So You lutte contre les problématiques écologiques en privilégiant des matières premières équitables, durables et respectueuses de la biodiversité. La qualité du produit fini prime toujours sur le packaging.
          </p>
        </div>

        {/* 4 Commitment Cards — 2x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 max-w-4xl mx-auto">
          {commitments.map((item, index) => (
            <div
              key={index}
              className="group flex items-start gap-6 bg-white rounded-[30px] p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.1)] hover:-translate-y-2 transition-all duration-700 reveal border border-slate-stone/5"
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div className="w-14 h-14 bg-mist-white rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                {item.icon}
              </div>
              <div>
                <h3 className="font-sans tracking-[0.15em] uppercase text-sm font-bold text-slate-stone mb-3">
                  {item.title}
                </h3>
                <p className="font-sans font-light text-stone-gray leading-relaxed text-[15px]">
                  {item.text}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Le saviez-vous callout */}
        <div className="max-w-3xl mx-auto mt-16 reveal">
          <div className="bg-white rounded-[30px] p-10 md:p-12 border border-slate-stone/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
            <p className="font-sans text-xs tracking-[0.3em] uppercase text-slate-stone/40 font-bold mb-4">Le saviez-vous ?</p>
            <p className="font-serif text-xl md:text-2xl text-slate-stone leading-relaxed italic">
              Notre production ne génère aucune émission de gaz, fumée ou déchet toxique. Tous nos emballages sont recyclables, rechargeables ou biodégradables.
            </p>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Ingredients;

import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import IconeEngagement from './IconeEngagement';

const Ingredients = () => {
  const { t } = useLanguage();
  // Une icone par engagement, dans leur ordre. Il y en avait quatre pour cinq
  // cartes : la derniere affichait une boite vide, qu'on lit comme une image qui
  // n'a pas charge plutot que comme un parti pris.
  const commitments = t('ingredients.commitments');

  return (
    <section className="py-24 md:py-40 bg-mist-white relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-green-50/40 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-50/30 rounded-full blur-3xl pointer-events-none translate-x-1/2 translate-y-1/2"></div>

      <div className="container mx-auto px-6 md:px-12 relative z-10">
        
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-24 reveal">
          <p className="font-sans text-[10px] caps-label text-stone-gray/40 mb-6 font-bold">{t('ingredients.eyebrow')}</p>
          <h2 className=" font-serif text-4xl md:text-7xl text-slate-stone mb-8 md:mb-10">
            {t('ingredients.titleLine1')}<br/><span className="italic text-slate-stone/40 font-light">{t('ingredients.titleLine2')}</span>
          </h2>
          <p className="font-sans font-light text-stone-gray text-lg md:text-xl leading-relaxed">
            {t('ingredients.intro')}
          </p>
        </div>

        {/* 4 Commitment Cards — 2x2 Grid */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:gap-8 max-w-4xl mx-auto">
          {commitments.map((item, index) => {
            // Un nombre impair d'engagements laisse la dernière carte seule sur
            // sa ligne. Elle restait calée à gauche, sous une colonne vide : on
            // lisait un trou plutôt qu'une fin.
            //
            // Elle a d'abord été centrée en gardant la largeur d'une colonne,
            // ce qui laissait deux vides au lieu d'un. Elle prend maintenant
            // toute la largeur de la rangée : c'est la seule façon de finir un
            // nombre impair sans vide du tout, et c'est aussi la carte au texte
            // le plus long — celui qui a le plus besoin de la place.
            const seuleSurSaLigne = index === commitments.length - 1 && commitments.length % 2 === 1;
            return (
            <div
              key={index}
              // Les cartes d'une rangee prennent la hauteur de la plus longue.
              // Le contenu des plus courtes restait colle en haut, laissant
              // jusqu'a 178 px de vide en dessous — ce qui se lit comme un
              // element qui n'a pas charge. `justify-center` repartit cet ecart
              // au-dessus et en dessous, et l'icone garde son alignement sur le
              // titre parce qu'elle vit dans le bloc interieur.
              className={`group flex flex-col justify-center bg-ivory rounded-[20px] sm:rounded-[30px] p-4 sm:p-8 md:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgb(0,0,0,0.1)] hover:-translate-y-2 transition-[opacity,transform,box-shadow] duration-300 reveal border border-slate-stone/5${
                seuleSurSaLigne ? ' col-span-2' : ''
              }`}
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3 sm:gap-6">
              <div className="w-10 h-10 sm:w-14 sm:h-14 bg-mist-white rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 text-slate-stone/70 group-hover:scale-110 group-hover:text-slate-stone transition-all duration-250">
                <IconeEngagement index={index} className="w-5 h-5 sm:w-7 sm:h-7" />
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
            </div>
            );
          })}
        </div>

        {/* Le saviez-vous callout */}
        <div className="max-w-3xl mx-auto mt-16 reveal">
          <div className="bg-ivory rounded-[30px] p-10 md:p-12 border border-slate-stone/5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-center">
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

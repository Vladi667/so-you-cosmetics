import React from 'react';
import Lien from '../components/Lien';
import { useParams } from 'react-router-dom';
import Catalog from '../components/Catalog';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';

const CategoryPage = ({ addToCart, toggleFavorite, favorites }) => {
  const { t, tCategory } = useLanguage();
  const { categoryName } = useParams();

  // Decode the URL parameter just in case
  const decodedCategory = decodeURIComponent(categoryName || 'All');

  const estToute = decodedCategory === 'All';

  // « Tous » n'est pas une rubrique mais la boutique entière : elle mérite son
  // propre titre plutôt que le libellé d'un filtre.
  //
  // La description ne reprend plus about.s2p1. Les quatorze pages de rubrique
  // et l'accueil la partageaient mot pour mot, et c'est un paragraphe d'essai
  // qui ne nomme ni Genève, ni la boutique, ni ce qu'on peut y acheter — sa
  // seconde moitié énumère des produits d'hygiène que la boutique ne vend pas
  // forcément. Le serveur en écrit une bonne au premier chargement ; celle-ci
  // vaut pour la navigation interne, et distingue au moins les rubriques.
  useMetadonnees({
    titre: estToute ? t('nav.shop') : tCategory(decodedCategory),
    description: estToute
      ? t('category.intro')
      : `${tCategory(decodedCategory)} : ${t('category.intro')}`,
  });

  return (
    <div className="pt-24 min-h-screen bg-mist-white flex flex-col">
      <div className="flex-grow">
        <div className="container mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-4 text-xs tracking-widest uppercase text-stone-gray mb-8">
            <Lien to="/" className="hover:text-slate-stone transition-colors">{t('category.home')}</Lien>
            <span>/</span>
            <span className="text-slate-stone font-medium">{tCategory(decodedCategory)}</span>
          </div>

          {/* Le titre de premier niveau, qui manquait.
              Ces pages n'avaient aucun <h1> : leur premier titre venait du
              catalogue, « Découvrez So You », le même sur les quatorze et sur
              l'accueil. Ce sont pourtant les pages qu'on atteint en cherchant
              « savon artisanal Genève », et rien n'y disait ni ce qu'on y
              vend, ni où. */}
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-slate-stone mb-5 max-w-3xl">
            {estToute
              ? t('category.headingAll')
              : t('category.heading', { nom: tCategory(decodedCategory) })}
          </h1>
          <p className="font-sans font-light text-stone-gray leading-relaxed max-w-2xl">
            {t('category.intro')}
          </p>
        </div>

        {/* Le catalogue ne pose plus son propre en-tête ici : la page en a un,
            et deux titres qui se suivent en disant la même chose n'aident
            personne — ni le lecteur, ni le plan du document. */}
        <Catalog
          globalActiveCategory={decodedCategory}
          sansEntete
          addToCart={addToCart}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
        />
      </div>
    </div>
  );
};

export default CategoryPage;

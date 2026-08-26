import React from 'react';
import { useParams, Link } from 'react-router-dom';
import Catalog from '../components/Catalog';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';

const CategoryPage = ({ addToCart, toggleFavorite, favorites }) => {
  const { t, tCategory } = useLanguage();
  const { categoryName } = useParams();

  // Decode the URL parameter just in case
  const decodedCategory = decodeURIComponent(categoryName || 'All');

  // « Tous » n'est pas une rubrique mais la boutique entière : elle mérite son
  // propre titre plutôt que le libellé d'un filtre.
  useMetadonnees({
    titre: decodedCategory === 'All' ? t('nav.shop') : tCategory(decodedCategory),
    description: t('about.s2p1'),
  });

  return (
    <div className="pt-24 min-h-screen bg-mist-white flex flex-col">
      <div className="flex-grow">
        <div className="container mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-4 text-xs tracking-widest uppercase text-stone-gray mb-8">
            <Link to="/" className="hover:text-slate-stone transition-colors">{t('category.home')}</Link>
            <span>/</span>
            <span className="text-slate-stone font-medium">{tCategory(decodedCategory)}</span>
          </div>
        </div>
        
        <Catalog 
          globalActiveCategory={decodedCategory} 
          setGlobalCategory={() => {}} // Controlled by URL now
          addToCart={addToCart} 
          toggleFavorite={toggleFavorite} 
          favorites={favorites} 
        />
      </div>
    </div>
  );
};

export default CategoryPage;

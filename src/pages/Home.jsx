import React from 'react';
import Hero from '../components/Hero';
import BrandEssence from '../components/BrandEssence';
import SignatureProducts from '../components/SignatureProducts';
import HandmadeGeneva from '../components/HandmadeGeneva';
import Ingredients from '../components/Ingredients';
import Workshops from '../components/Workshops';
import Catalog from '../components/Catalog';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';

const Home = ({ addToCart, toggleFavorite, favorites }) => {
  const { t } = useLanguage();
  // Pas de titre propre : l'accueil garde celui du site, qui est déjà le sien.
  // Seule la description manquait.
  useMetadonnees({ description: t('about.s2p1') });

  return (
    <>
      <Hero />
      <BrandEssence />
      <SignatureProducts addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />
      <HandmadeGeneva />
      {/* En aperçu : la boutique entière était montée ici, défilement infini
          compris, et la page d'accueil ne se terminait donc jamais. */}
      <Catalog
        apercu
        globalActiveCategory="All"
        setGlobalCategory={() => {}} // No-op on home page since top nav handles routing now
        addToCart={addToCart}
        toggleFavorite={toggleFavorite}
        favorites={favorites}
      />
      <Ingredients />
      <Workshops />
    </>
  );
};

export default Home;

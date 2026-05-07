import React from 'react';
import Hero from '../components/Hero';
import BrandEssence from '../components/BrandEssence';
import SignatureProducts from '../components/SignatureProducts';
import HandmadeGeneva from '../components/HandmadeGeneva';
import Ingredients from '../components/Ingredients';
import Workshops from '../components/Workshops';
import Catalog from '../components/Catalog';

const Home = ({ addToCart, toggleFavorite, favorites }) => {
  return (
    <>
      <Hero />
      <BrandEssence />
      <SignatureProducts addToCart={addToCart} toggleFavorite={toggleFavorite} favorites={favorites} />
      <HandmadeGeneva />
      <Catalog 
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

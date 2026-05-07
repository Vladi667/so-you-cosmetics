import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Catalog from '../components/Catalog';

const CategoryPage = ({ addToCart, toggleFavorite, favorites }) => {
  const { categoryName } = useParams();
  
  // Decode the URL parameter just in case
  const decodedCategory = decodeURIComponent(categoryName || 'All');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [decodedCategory]);

  return (
    <div className="pt-24 min-h-screen bg-mist-white flex flex-col">
      <div className="flex-grow">
        <div className="container mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-4 text-xs tracking-widest uppercase text-stone-gray mb-8">
            <a href="/" className="hover:text-slate-stone transition-colors">Home</a>
            <span>/</span>
            <span className="text-slate-stone font-medium">{decodedCategory}</span>
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

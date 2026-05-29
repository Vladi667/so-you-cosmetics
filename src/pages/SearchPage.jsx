import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Catalog from '../components/Catalog';

const SearchPage = ({ addToCart, toggleFavorite, favorites }) => {
  const { query } = useParams();
  const decoded = decodeURIComponent(query || '');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [decoded]);

  return (
    <div className="pt-24 min-h-screen bg-mist-white flex flex-col">
      <div className="flex-grow">
        <div className="container mx-auto px-6 pt-12 pb-4">
          <div className="flex items-center gap-4 text-xs tracking-widest uppercase text-stone-gray mb-8">
            <Link to="/" className="hover:text-slate-stone transition-colors">Home</Link>
            <span>/</span>
            <span className="text-slate-stone font-medium">Recherche : {decoded}</span>
          </div>
        </div>

        <Catalog
          globalActiveCategory="All"
          setGlobalCategory={() => {}}
          searchQuery={decoded}
          addToCart={addToCart}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
        />
      </div>
    </div>
  );
};

export default SearchPage;

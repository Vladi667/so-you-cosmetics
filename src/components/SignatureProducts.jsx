import React from 'react';
import { Link } from 'react-router-dom';
import SectionHeader from './SectionHeader';

import productsData from '../data/products.json';

const SignatureProducts = ({ addToCart, toggleFavorite, favorites }) => {
  // Best sellers with best photos — hand-picked
  const bestNames = [
    'Stick lèvres naturel - cacao, coco, amande douce et cranberry',
    'Stick lèvres naturel - cacao bio, coco bio, amande douce bio sans parfum',
    'Soin des lèvres bonne mine - karité, coco et jojoba',
    'Savon olive, coco, ricin, palme RSPO - Senteur Vanilla Moon',
    'Savon olive, coco, ricin, palme RSPO - Senteur Woody',
    'Savon olive, coco, ricin, palme RSPO - Senteur Agrumes',
    'Savon olive, coco, ricin, palme RSPO - Senteur Eté Indien',
    'Savon olive, coco, ricin, palme RSPO - Senteur Lolipop - Edition Limitée',
    'Savon olive, coco, ricin, palme RSPO - Senteur Légère Fraise',
  ];
  const products = bestNames
    .map(name => productsData.products.find(p => p.name === name))
    .filter(Boolean);
  // Duplicate for infinite scroll
  const duplicatedProducts = [...products, ...products, ...products];

  return (
    <section id="products" className="py-32 bg-mist-white overflow-hidden">
      <div className="container mx-auto px-6 md:px-12 mb-16">
        <SectionHeader 
          title="Signature Collection" 
          subtitle="Our most exquisite botanical formulations, curated for your daily ritual."
          align="center"
        />
      </div>
      
      <div className="relative w-full overflow-hidden flex carousel-wrapper cursor-grab">
        <div className="flex animate-marquee-slow w-max">
          {duplicatedProducts.map((product, index) => (
            <div 
              key={index} 
              className="w-[280px] md:w-[350px] mx-4 shrink-0 cursor-pointer"
            >
              <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-white mb-6 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-700 group/card">
                {/* Product Image */}
                {product.images && product.images.length > 0 ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover object-center absolute inset-0 transition-transform duration-1000 group-hover/card:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-alpine-silver flex items-center justify-center p-8 transition-transform duration-1000 group-hover/card:scale-105">
                    <div className="w-32 h-48 bg-gradient-to-tr from-white to-mist-blue/20 rounded-lg shadow-inner flex items-center justify-center opacity-80 border border-white/50">
                       <span className="font-serif text-slate-stone/40 text-4xl tracking-widest">SY</span>
                    </div>
                  </div>
                )}
                
                {/* Overlay gradient */}
                <Link to={`/product/${product.id}`} className="absolute inset-0 z-0 bg-gradient-to-t from-slate-stone/40 via-transparent to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-700"></Link>
                
                {/* Explore button that appears on hover */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 translate-y-10 opacity-0 group-hover/card:translate-y-0 group-hover/card:opacity-100 transition-all duration-500 ease-out flex space-x-3 z-10">
                  <button 
                    onClick={() => addToCart(product)}
                    className="px-6 py-2 bg-white/90 backdrop-blur-sm text-slate-stone text-xs uppercase tracking-widest rounded-full font-medium hover:bg-slate-stone hover:text-white transition-colors"
                  >
                    Add
                  </button>
                  <button 
                    onClick={() => toggleFavorite(product)}
                    className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-slate-stone hover:text-white transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={favorites.find(f => f.id === product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <p className="text-xs uppercase tracking-widest text-mist-blue mb-2 font-medium">{product.collections[0] || 'Cosmetics'}</p>
                <Link to={`/product/${product.id}`}>
                  <h3 className="font-serif text-xl text-slate-stone mb-1 line-clamp-1 px-4 hover:text-stone-gray transition-colors">{product.name}</h3>
                </Link>
                <p className="font-sans text-sm text-stone-gray">CHF {product.price.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SignatureProducts;

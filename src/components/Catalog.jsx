import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SectionHeader from './SectionHeader';
import productsData from '../data/products.json';

const placeholders = [
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1615397323136-1681280f55aa?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&w=600&q=80'
];

function Catalog({ globalActiveCategory = 'All', setGlobalCategory, addToCart, toggleFavorite, favorites }) {
  const [activeCategory, setActiveCategory] = useState(globalActiveCategory);
  const [displayedProducts, setDisplayedProducts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(12);
  const [isAnimating, setIsAnimating] = useState(false);
  const scrollRef = useRef(null);

  const categories = [
    'All',
    'Savons',
    'Soins de la peau',
    'Bien-être et détente',
    'Bébés',
    'Accessoires',
    'Hommes',
    'Shampoings',
    'Enfants',
    'Soin des lèvres',
    'Ambiance',
    'Savon Liquide',
    'Soin des cheveux'
  ];

  useEffect(() => {
    setActiveCategory(globalActiveCategory);
  }, [globalActiveCategory]);

  useEffect(() => {
    setIsAnimating(true);
    
    const timer = setTimeout(() => {
      let filtered = productsData.products;
      if (activeCategory !== 'All') {
        filtered = productsData.products.filter(p => p.collections.includes(activeCategory));
      }
      setDisplayedProducts(filtered);
      setVisibleCount(12); // Reset visible count on category change
      
      // Allow enter animation to play
      setTimeout(() => setIsAnimating(false), 50);
    }, 300);

    return () => clearTimeout(timer);
  }, [activeCategory]);

  const loadMore = () => {
    setVisibleCount(prev => prev + 12);
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    const hiddenElements = document.querySelectorAll('#catalog .reveal');
    hiddenElements.forEach((el) => observer.observe(el));

    return () => {
      hiddenElements.forEach((el) => observer.unobserve(el));
    };
  }, [displayedProducts, visibleCount]);

  // Drag to scroll for categories
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e) => {
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  return (
    <section id="catalog" className="py-24 bg-mist-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <SectionHeader 
          title="The Full Collection" 
          subtitle="Discover our complete range of artisanal, handmade cosmetics crafted in Geneva."
        />

        {/* Categories Filter */}
        <div className="mt-12 mb-16 relative">
          <div 
            ref={scrollRef}
            className="flex space-x-4 overflow-x-auto pb-4 hide-scrollbar cursor-grab active:cursor-grabbing"
            onMouseDown={onMouseDown}
            onMouseLeave={onMouseLeave}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
          >
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  if (setGlobalCategory) setGlobalCategory(category);
                }}
                className={`whitespace-nowrap px-6 py-3 rounded-full text-sm tracking-widest uppercase transition-all duration-300 border ${
                  activeCategory === category 
                  ? 'bg-slate-stone text-white border-slate-stone shadow-lg' 
                  : 'bg-transparent text-slate-stone border-slate-stone/20 hover:border-slate-stone/50 hover:bg-slate-stone/5'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          {/* Subtle gradient fades for scroll indication */}
          <div className="absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-mist-white to-transparent pointer-events-none"></div>
          <div className="absolute top-0 left-0 h-full w-16 bg-gradient-to-r from-mist-white to-transparent pointer-events-none"></div>
        </div>

        {/* Products Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 transition-all duration-500 ease-in-out ${isAnimating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          {displayedProducts.slice(0, visibleCount).map((product, index) => {
            const placeholderImg = placeholders[product.name.length % placeholders.length];
            return (
              <div 
                key={product.id} 
                className="group relative flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 reveal"
                style={{ transitionDelay: `${(index % 12) * 100}ms` }}
              >
                <div className="aspect-[4/5] w-full overflow-hidden bg-slate-100 relative">
                  <img
                    src={product.images.length > 0 ? product.images[0] : placeholders[product.name.length % placeholders.length]}
                    alt={product.name}
                    loading="lazy"
                    className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
                  />
                  {product.ribbon && (
                    <div className="absolute top-4 left-4 z-10">
                      <span className="inline-block bg-white/90 backdrop-blur-sm text-slate-stone text-xs tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm">
                        {product.ribbon}
                      </span>
                    </div>
                  )}
                  {/* Hover Overlay — on mobile the card image is directly tappable */}
                  <Link to={`/product/${product.id}`} className="absolute inset-0 bg-slate-stone/10 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center md:backdrop-blur-[2px]">
                    <span className="transform translate-y-4 md:group-hover:translate-y-0 opacity-0 md:group-hover:opacity-100 transition-all duration-500 bg-white text-slate-stone px-8 py-3 rounded-full font-medium tracking-wide shadow-lg hover:bg-slate-stone hover:text-white hidden md:inline">
                      View Details
                    </span>
                  </Link>
                </div>
                
                <div className="p-6 flex flex-col flex-grow">
                  <div className="mb-2">
                    <p className="text-xs text-slate-stone/60 uppercase tracking-widest mb-1 truncate">
                      {product.collections[0] || 'Cosmetics'}
                    </p>
                    <Link to={`/product/${product.id}`}>
                      <h3 className="text-lg font-serif text-slate-stone leading-tight line-clamp-2 hover:text-stone-gray transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                  </div>
                  <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-stone/10">
                    <p className="text-slate-stone font-medium tracking-wide">
                      CHF {product.price.toFixed(2)}
                    </p>
                    <div className="flex space-x-3">
                      <button 
                        onClick={() => toggleFavorite(product)}
                        className={`transition-colors duration-300 ${favorites.find(f => f.id === product.id) ? 'text-red-400' : 'text-slate-stone/60 hover:text-red-400'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill={favorites.find(f => f.id === product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      <button 
                        onClick={(e) => {
                          const btn = e.currentTarget;
                          btn.classList.add('scale-110');
                          setTimeout(() => btn.classList.remove('scale-110'), 200);
                          addToCart(product);
                        }}
                        className="text-slate-stone/60 hover:text-slate-stone transition-all duration-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty State */}
        {displayedProducts.length === 0 && (
          <div className="text-center py-24">
            <p className="text-slate-stone/60 text-lg">No products found in this category.</p>
          </div>
        )}

        {/* Load More */}
        {visibleCount < displayedProducts.length && (
          <div className="mt-16 text-center">
            <button 
              onClick={loadMore}
              className="inline-block border-b border-slate-stone text-slate-stone tracking-widest uppercase text-sm pb-1 hover:text-slate-stone/70 hover:border-slate-stone/70 transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default Catalog;

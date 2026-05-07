import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import productsData from '../data/products.json';

const placeholders = [
  'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1599305090598-fe179d501227?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1615397323136-1681280f55aa?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1629198688000-71f23e745b6e?auto=format&fit=crop&w=600&q=80'
];

const ProductPage = ({ addToCart, toggleFavorite, favorites }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const foundProduct = productsData.products.find(p => p.id === id);
    
    if (foundProduct) {
      setProduct(foundProduct);
      setActiveImage(0);
      setQuantity(1);
      
      // Find related products in the same primary category
      const primaryCategory = foundProduct.collections[0] || 'All';
      const related = productsData.products
        .filter(p => p.id !== id && p.collections.includes(primaryCategory))
        .slice(0, 4);
      setRelatedProducts(related);
    } else {
      // Product not found, maybe redirect to shop
      navigate('/');
    }
  }, [id, navigate]);

  if (!product) return null;

  const isFavorite = favorites.some(p => p.id === product.id);
  
  // Use real images if available, otherwise fallback
  const images = product.images && product.images.length > 0 
    ? product.images 
    : [placeholders[product.name.length % placeholders.length]];

  const handleAddToCart = () => {
    // In a real app we'd pass quantity, but for now we'll just add it multiple times or rely on the cart logic
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-mist-white flex flex-col">
      <div className="flex-grow pb-24">
        {/* Breadcrumb */}
        <div className="container mx-auto px-6 pt-12 pb-8">
          <div className="flex flex-wrap items-center gap-3 text-xs tracking-widest uppercase text-stone-gray">
            <Link to="/" className="hover:text-slate-stone transition-colors">Home</Link>
            <span>/</span>
            <Link to={`/category/${product.collections[0] || 'All'}`} className="hover:text-slate-stone transition-colors">
              {product.collections[0] || 'Shop'}
            </Link>
            <span>/</span>
            <span className="text-slate-stone font-medium truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
          </div>
        </div>

        <div className="container mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            
            {/* Left: Image Gallery */}
            <div className="w-full lg:w-1/2">
              <div className="sticky top-32">
                <div className="aspect-[4/5] w-full rounded-3xl overflow-hidden bg-white shadow-sm mb-6 relative group">
                  {product.ribbon && (
                    <div className="absolute top-6 left-6 z-10">
                      <span className="inline-block bg-white/90 backdrop-blur-md text-slate-stone text-xs tracking-widest uppercase px-4 py-2 rounded-full shadow-sm font-medium">
                        {product.ribbon}
                      </span>
                    </div>
                  )}
                  <img 
                    src={images[activeImage]} 
                    alt={product.name} 
                    className="w-full h-full object-cover object-center transition-opacity duration-500"
                  />
                </div>
                
                {/* Thumbnails */}
                {images.length > 1 && (
                  <div className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar">
                    {images.map((img, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setActiveImage(idx)}
                        className={`w-20 h-24 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-300 ${activeImage === idx ? 'border-slate-stone opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={img} alt={`${product.name} ${idx+1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Product Details */}
            <div className="w-full lg:w-1/2 lg:py-10">
              <div className="mb-8">
                <div className="flex flex-wrap gap-2 mb-4">
                  {product.collections.map((cat, idx) => (
                    <Link 
                      key={idx} 
                      to={`/category/${cat}`}
                      className="text-[10px] tracking-widest uppercase text-stone-gray hover:text-slate-stone transition-colors bg-white px-3 py-1 rounded-full border border-slate-stone/10"
                    >
                      {cat}
                    </Link>
                  ))}
                </div>
                <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-slate-stone leading-tight mb-6">
                  {product.name}
                </h1>
                <p className="font-sans text-2xl text-stone-gray font-light">CHF {product.price.toFixed(2)}</p>
              </div>

              <div className="h-px w-full bg-slate-stone/10 my-8"></div>

              {/* HTML Description */}
              {product.description ? (
                <div 
                  className="prose prose-sm prose-slate max-w-none font-sans font-light text-stone-gray leading-relaxed mb-10"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              ) : (
                <p className="font-sans font-light text-stone-gray leading-relaxed mb-10">
                  Un produit artisanal So You, fait main avec amour à Genève.
                </p>
              )}

              {/* Add to Cart Actions */}
              <div className="flex flex-col sm:flex-row gap-4 mt-12">
                <div className="flex items-center justify-between border border-slate-stone/20 rounded-full px-6 py-4 sm:w-1/3 bg-white">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="text-stone-gray hover:text-slate-stone transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
                  </button>
                  <span className="font-sans text-sm">{quantity}</span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="text-stone-gray hover:text-slate-stone transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  </button>
                </div>
                
                <button 
                  onClick={handleAddToCart}
                  className="flex-grow bg-slate-stone text-white rounded-full py-4 px-8 font-sans text-xs tracking-widest uppercase hover:bg-stone-gray transition-all duration-500 shadow-xl hover:shadow-2xl hover:-translate-y-1"
                >
                  Ajouter au panier
                </button>
                
                <button 
                  onClick={() => toggleFavorite(product)}
                  className={`w-14 h-14 flex items-center justify-center rounded-full border transition-all duration-300 flex-shrink-0 ${isFavorite ? 'border-red-400 bg-red-50 text-red-500' : 'border-slate-stone/20 bg-white text-stone-gray hover:border-slate-stone'}`}
                >
                  <svg className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              
              {/* Shipping info */}
              <div className="mt-10 p-6 bg-white rounded-2xl border border-slate-stone/5 flex items-start gap-4">
                <span className="text-2xl">📦</span>
                <div>
                  <h4 className="font-sans text-xs tracking-widest uppercase text-slate-stone font-bold mb-2">Livraison Suisse</h4>
                  <p className="font-sans text-sm text-stone-gray font-light">Livraison offerte dès CHF 100.- d'achat. Expédition sous 2 à 4 jours ouvrés.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="container mx-auto px-6 lg:px-12 mt-32">
            <h3 className="font-serif text-3xl text-slate-stone mb-12 text-center">Vous aimerez aussi</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {relatedProducts.map((p, index) => {
                const img = p.images.length > 0 ? p.images[0] : placeholders[p.name.length % placeholders.length];
                const isFav = favorites.some(fav => fav.id === p.id);
                return (
                  <div key={p.id} className="group relative flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500">
                    <Link to={`/product/${p.id}`} className="aspect-[4/5] w-full overflow-hidden bg-slate-100 relative block">
                      <img src={img} alt={p.name} className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-in-out" />
                      {p.ribbon && (
                        <div className="absolute top-4 left-4 z-10">
                          <span className="inline-block bg-white/90 backdrop-blur-sm text-slate-stone text-xs tracking-widest uppercase px-3 py-1.5 rounded-full shadow-sm">
                            {p.ribbon}
                          </span>
                        </div>
                      )}
                    </Link>
                    <div className="p-6 flex flex-col flex-grow">
                      <Link to={`/product/${p.id}`} className="block">
                        <p className="font-sans text-[9px] tracking-[0.2em] uppercase text-stone-gray mb-2">{p.collections[0] || 'So You'}</p>
                        <h3 className="font-serif text-xl text-slate-stone mb-3 line-clamp-2 group-hover:text-stone-gray transition-colors">{p.name}</h3>
                      </Link>
                      <div className="mt-auto flex items-center justify-between pt-4 border-t border-slate-stone/10">
                        <span className="font-sans text-sm text-stone-gray">CHF {p.price.toFixed(2)}</span>
                        <div className="flex gap-2">
                          <button onClick={() => toggleFavorite(p)} className={`p-2 rounded-full border transition-colors ${isFav ? 'border-red-400 text-red-500 bg-red-50' : 'border-slate-stone/20 text-slate-stone hover:bg-slate-stone hover:text-white'}`}>
                            <svg className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                          <button onClick={() => addToCart(p)} className="p-2 rounded-full bg-slate-stone text-white hover:bg-stone-gray transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;

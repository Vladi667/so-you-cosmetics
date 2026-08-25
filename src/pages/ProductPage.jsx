import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProducts, imageUrl } from '../services/products';
import { useLanguage } from '../i18n/LanguageContext';
import ProductPlaceholder from '../components/ProductPlaceholder';
import ProductBadge from '../components/ProductBadge';
import { descriptionToHtml } from '../utils/description';
import { ouvrirPanier } from '../services/panier';



// Ce qu'on montre pendant que la fiche arrive.
//
// La page renvoyait `null` : un ecran blanc, sans en-tete, sans fil d'Ariane,
// pendant tout l'aller-retour reseau. Le visiteur venait de cliquer un produit
// et n'avait aucun signe que quelque chose se passait — sur une connexion lente,
// cela se lit comme un lien mort.
const SqueletteFiche = () => (
  <div className="pt-24 min-h-screen bg-mist-white flex flex-col" aria-busy="true">
    <div className="flex-grow pb-24">
      <div className="container mx-auto px-6 pt-12 pb-8">
        <div className="h-3 w-64 rounded bg-lake-mist animate-pulse" />
      </div>
      <div className="container mx-auto px-6 lg:px-12">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          <div className="w-full lg:w-1/2">
            <div className="aspect-[4/5] w-full rounded-3xl bg-lake-mist animate-pulse mb-6" />
            <div className="flex gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="w-20 h-24 flex-shrink-0 rounded-xl bg-lake-mist animate-pulse" />
              ))}
            </div>
          </div>
          <div className="w-full lg:w-1/2 lg:py-10">
            <div className="mb-8">
              <div className="flex gap-2 mb-4">
                <div className="h-6 w-24 rounded-full bg-lake-mist animate-pulse" />
                <div className="h-6 w-20 rounded-full bg-lake-mist animate-pulse" />
              </div>
              {/* Meme balise et memes classes que le vrai titre : la hauteur de
                  ligne est celle du texte reel, pas une hauteur devinee. */}
              <h1 className=" font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl mb-4 md:mb-6">
                <span className="inline-block w-4/5 rounded bg-lake-mist animate-pulse">&nbsp;</span>
              </h1>
              <p className="font-sans text-2xl font-light">
                <span className="inline-block w-32 rounded bg-lake-mist animate-pulse">&nbsp;</span>
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="h-14 sm:w-1/3 rounded-full bg-lake-mist animate-pulse" />
              <div className="h-14 flex-grow rounded-full bg-lake-mist animate-pulse" />
              <div className="h-14 w-14 rounded-full bg-lake-mist animate-pulse flex-shrink-0" />
            </div>
            <div className="h-px w-full bg-slate-stone/10 my-8" />
            <div className="space-y-3">
              {['w-full', 'w-11/12', 'w-full', 'w-2/3'].map((l, i) => (
                <div key={i} className={`h-4 rounded bg-lake-mist animate-pulse ${l}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ProductPage = ({ addToCart, toggleFavorite, favorites }) => {
  const { t, tCategory } = useLanguage();
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState([]);
  // La seule confirmation d'un ajout etait un chiffre qui changeait dans
  // l'en-tete — souvent hors du champ de vision sur mobile, ou l'on regarde le
  // bouton qu'on vient de toucher.
  const [ajoute, setAjoute] = useState(false);

  useEffect(() => {
    getProducts().then(data => handleProductsLoaded(data));

    function handleProductsLoaded(productsList) {
      const foundProduct = productsList.find(p => p.id === id);
      
      if (foundProduct) {
        setProduct(foundProduct);
        setActiveImage(0);
        setQuantity(1);
        
        // Ce qu'elle a choisi elle-même passe avant tout calcul : « dans la
        // section Vous aimerez aussi, j'aimerais pouvoir choisir moi-même les
        // produits qui apparaissent, plutôt que de laisser une sélection
        // automatique ». Elle connaît ses clients mieux qu'un score de
        // catégories communes.
        //
        // Les identifiants absents du catalogue sont ignorés : un produit
        // supprimé ne doit pas laisser un trou dans la rangée.
        const choisis = (foundProduct.related || [])
          .map((rid) => productsList.find((p) => p.id === rid))
          .filter(Boolean);
        if (choisis.length > 0) {
          setRelatedProducts(choisis.slice(0, 4));
          return;
        }

        // Sinon, la sélection automatique d'origine : classer les autres
        // produits par nombre de catégories partagées, pour qu'un savon suggère
        // des savons et un hydrolat des hydrolats.
        const currentCols = foundProduct.collections || [];
        const scored = productsList
          .filter(p => p.id !== id)
          .map(p => ({
            product: p,
            shared: (p.collections || []).filter(c => currentCols.includes(c)).length
          }))
          .filter(x => x.shared > 0)
          .sort((a, b) => b.shared - a.shared);

        let related = scored.slice(0, 4).map(x => x.product);

        // Fallback: if too few share a category, top up with other products so
        // the section is never awkwardly empty.
        if (related.length < 4) {
          const taken = new Set([id, ...related.map(r => r.id)]);
          const fillers = productsList.filter(p => !taken.has(p.id)).slice(0, 4 - related.length);
          related = related.concat(fillers);
        }
        setRelatedProducts(related);
      } else {
        // Product not found, redirect to home
        navigate('/');
      }
    }
  }, [id, navigate]);

  // Le message s'efface seul. La minuterie est nettoyée au démontage : quitter
  // la fiche entre-temps ferait écrire dans un composant parti.
  useEffect(() => {
    if (!ajoute) return undefined;
    const minuterie = setTimeout(() => setAjoute(false), 5000);
    return () => clearTimeout(minuterie);
  }, [ajoute]);

  if (!product) return <SqueletteFiche />;

  const isFavorite = favorites.some(p => p.id === product.id);
  
  // Use real images if available, otherwise fallback
  const images = product.images && product.images.length > 0 
    ? product.images 
    : [];   // aucune photo : on montre un cadre honnête, pas l'image d'une autre marque

  const handleAddToCart = () => {
    // In a real app we'd pass quantity, but for now we'll just add it multiple times or rely on the cart logic
    // Un seul appel avec la quantité : la boucle créait autant de lignes
    // identiques que d'unités, et chacune relançait l'animation du panier.
    addToCart(product, quantity);
    setAjoute(true);
  };


  return (
    <div className="pt-24 min-h-screen bg-mist-white flex flex-col">
      <div className="flex-grow pb-24">
        {/* Breadcrumb */}
        <div className="container mx-auto px-6 pt-12 pb-8">
          <div className="flex flex-wrap items-center gap-3 text-xs tracking-widest uppercase text-stone-gray">
            <Link to="/" className="hover:text-slate-stone transition-colors">{t('product.home')}</Link>
            <span>/</span>
            <Link to={`/category/${product.collections[0] || 'All'}`} className="hover:text-slate-stone transition-colors">
              {product.collections[0] ? tCategory(product.collections[0]) : t('product.shopFallback')}
            </Link>
            <span>/</span>
            <span className="text-slate-stone font-medium truncate max-w-[200px] sm:max-w-xs">{product.name}</span>
          </div>
        </div>

        <div className="container mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            
            {/* Left: Image Gallery */}
            <div className="w-full lg:w-1/2">
              <div className="lg:sticky lg:top-32">
                <div className="aspect-[4/5] w-full rounded-3xl overflow-hidden bg-ivory shadow-sm mb-6 relative group">
                  {product.ribbon && (
                    <div className="absolute top-6 left-6 z-10">
                      <ProductBadge ribbon={product.ribbon} size="lg" />
                    </div>
                  )}
                  {images.length === 0 ? <ProductPlaceholder /> : (
                    <img
                      src={imageUrl(images[activeImage], 1600)}
                      alt={product.name}
                      /* La grande image de la fiche est ce qu'on vient voir, et
                         le plus gros element de la page. En « lazy », le
                         navigateur attendait d'avoir fini sa mise en page pour
                         la demander : le produit apparaissait apres son propre
                         cadre. Les vignettes, elles, restent differees. */
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                      className="w-full h-full object-cover object-center transition-opacity duration-500"
                    />
                  )}
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
                        <img src={imageUrl(img, 400)} alt={`${product.name} ${idx+1}`} loading="lazy" className="w-full h-full object-cover" />
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
                      className="text-[10px] tracking-widest uppercase text-stone-gray hover:text-slate-stone transition-colors bg-ivory px-3 py-1 rounded-full border border-slate-stone/10"
                    >
                      {tCategory(cat)}
                    </Link>
                  ))}
                </div>
                <h1 className=" font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-stone mb-4 md:mb-6">
                  {product.name}
                </h1>
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-sans text-2xl text-stone-gray font-light">CHF {product.price.toFixed(2)}</p>
                  {product.inStock === false && (
                    <span className="inline-block bg-red-100 text-red-700 text-xs tracking-widest uppercase px-3 py-1 rounded-full font-medium">
                      {t('catalog.outOfStock')}
                    </span>
                  )}
                </div>
              </div>

              {/* Add to Cart Actions */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center justify-between border border-slate-stone/20 rounded-full px-6 py-4 sm:w-1/3 bg-ivory">
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
                  disabled={product.inStock === false}
                  className={`flex-grow rounded-full py-4 px-8 font-sans text-xs tracking-widest uppercase transition-all duration-250 shadow-xl ${
                    product.inStock === false
                      ? 'bg-stone-gray/40 text-white cursor-not-allowed'
                      : 'bg-slate-stone text-white hover:bg-stone-gray hover:shadow-2xl hover:-translate-y-1'
                  }`}
                >
                  {product.inStock === false ? t('catalog.outOfStock') : t('product.addToCart')}
                </button>
                
                <button 
                  onClick={() => toggleFavorite(product)}
                  className={`w-14 h-14 flex items-center justify-center rounded-full border transition-all duration-300 flex-shrink-0 ${isFavorite ? 'border-red-400 bg-red-50 text-red-500' : 'border-slate-stone/20 bg-ivory text-stone-gray hover:border-slate-stone'}`}
                >
                  <svg className={`w-5 h-5 ${isFavorite ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
              </div>
              

              {ajoute && (
                <p
                  role="status"
                  className={`mt-4 font-sans text-sm text-stone-gray transition-opacity duration-300 ${ajoute ? 'opacity-100' : 'opacity-0'}`}
                >
                  {t('product.addedToCart')}{' '}
                  <button
                    type="button"
                    onClick={ouvrirPanier}
                    className="underline underline-offset-4 text-slate-stone hover:text-stone-gray transition-colors"
                  >
                    {t('product.seeCart')}
                  </button>
                </p>
              )}

              <div className="h-px w-full bg-slate-stone/10 my-8"></div>

              {/* HTML Description */}
              {product.description ? (
                <div
                  className="prose prose-sm prose-slate max-w-none font-sans font-light text-stone-gray leading-relaxed mb-10
                             prose-headings:font-serif prose-headings:text-slate-stone prose-headings:font-normal
                             prose-h2:text-xl prose-h3:text-lg prose-h4:text-base
                             prose-strong:text-slate-stone prose-strong:font-medium
                             prose-p:mb-4 prose-ul:my-4 prose-li:marker:text-stone-gray/50"
                  dangerouslySetInnerHTML={{ __html: descriptionToHtml(product.description) }}
                />
              ) : (
                <p className="font-sans font-light text-stone-gray leading-relaxed mb-10">
                  {t('product.defaultDesc')}
                </p>
              )}

              {/* Shipping info */}
              <div className="mt-10 p-6 bg-ivory rounded-2xl border border-slate-stone/5 flex items-start gap-4">
                <span className="text-2xl">📦</span>
                <div>
                  <h4 className="font-sans text-xs tracking-widest uppercase text-slate-stone font-bold mb-2">{t('product.shippingTitle')}</h4>
                  <p className="font-sans text-sm text-stone-gray font-light">{t('product.shippingText')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="container mx-auto px-6 lg:px-12 mt-32">
            <h3 className="font-serif text-3xl text-slate-stone mb-12 text-center">{t('product.youMayAlsoLike')}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {relatedProducts.map((p, index) => {
                const img = p.images.length > 0 ? p.images[0] : null;
                const isFav = favorites.some(fav => fav.id === p.id);
                return (
                  <div key={p.id} className="group relative flex flex-col bg-ivory rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-250">
                    <Link to={`/product/${p.id}`} className="aspect-[4/5] w-full overflow-hidden bg-lake-mist relative block">
                      {img ? (
                        <img src={imageUrl(img, 800)} alt={p.name} loading="lazy" className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-in-out" />
                      ) : <ProductPlaceholder />}
                      {p.ribbon && (
                        <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
                          <ProductBadge ribbon={p.ribbon} />
                        </div>
                      )}
                    </Link>
                    <div className="p-3 sm:p-6 flex flex-col flex-grow">
                      <Link to={`/product/${p.id}`} className="block">
                        <p className="font-sans text-[9px] sm:text-[10px] tracking-[0.2em] uppercase text-stone-gray mb-1 sm:mb-2">{p.collections[0] ? tCategory(p.collections[0]) : 'So You'}</p>
                        <h3 className="font-serif text-sm sm:text-xl text-slate-stone mb-2 sm:mb-3 line-clamp-2 group-hover:text-stone-gray transition-colors">{p.name}</h3>
                      </Link>
                      <div className="mt-auto flex items-center justify-between pt-2 sm:pt-4 border-t border-slate-stone/10">
                        <span className="font-sans text-xs sm:text-sm text-stone-gray">CHF {p.price.toFixed(2)}</span>
                        <div className="flex gap-1.5 sm:gap-2">
                          <button onClick={() => toggleFavorite(p)} className={`p-1.5 sm:p-2 rounded-full border transition-colors ${isFav ? 'border-red-400 text-red-500 bg-red-50' : 'border-slate-stone/20 text-slate-stone hover:bg-slate-stone hover:text-white'}`}>
                            <svg className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isFav ? 'fill-current' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                          </button>
                          <button onClick={() => addToCart(p)} className="p-1.5 sm:p-2 rounded-full bg-slate-stone text-white hover:bg-stone-gray transition-colors">
                            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

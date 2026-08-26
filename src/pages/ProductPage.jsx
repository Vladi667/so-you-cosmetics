import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProducts, imageUrl } from '../services/products';
import { useLanguage } from '../i18n/LanguageContext';
import ProductPlaceholder from '../components/ProductPlaceholder';
import ProductBadge from '../components/ProductBadge';
import { IconeSimple } from '../components/IconeEngagement';
import { descriptionToHtml } from '../utils/description';
import { lireRecette } from '../data/recettes';
import { ouvrirPanier } from '../services/panier';
import ImageProduit from '../components/ImageProduit';
import VisionneuseImage from '../components/VisionneuseImage';
import useMetadonnees from '../hooks/useMetadonnees';



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
  const [product, setProduct] = useState(null);
  const [introuvable, setIntrouvable] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [relatedProducts, setRelatedProducts] = useState([]);
  // La seule confirmation d'un ajout etait un chiffre qui changeait dans
  // l'en-tete — souvent hors du champ de vision sur mobile, ou l'on regarde le
  // bouton qu'on vient de toucher.
  const [ajoute, setAjoute] = useState(false);
  const [visionneuseOuverte, setVisionneuseOuverte] = useState(false);
  const [senteurs, setSenteurs] = useState([]);
  const [rituel, setRituel] = useState([]);
  // Faux par défaut : on n'engage pas quelqu'un à rapporter un flacon qu'il
  // n'a peut-être pas.
  const [enRecharge, setEnRecharge] = useState(false);
  // La barre d'achat collante ne paraît que lorsque le vrai bouton a quitté
  // l'écran. L'afficher en permanence doublerait un bouton déjà visible et
  // mangerait le bas de la fiche pour rien.
  const [boutonVisible, setBoutonVisible] = useState(true);
  const blocAchatRef = useRef(null);

  useEffect(() => {
    // Remis à zéro à chaque référence : le routeur garde le même composant
    // d'une fiche à l'autre, donc sans cette ligne un seul lien mort suffisait
    // à faire passer pour supprimés tous les produits consultés ensuite.
    setIntrouvable(false);
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
        // Le rituel auquel ce produit appartient. Les étapes sont triées par
        // leur numéro, et un rituel d'un seul produit n'en est pas un.
        const idRituel = foundProduct.rituel && foundProduct.rituel.id;
        if (idRituel) {
          const etapes = productsList
            .filter((p) => p.rituel && p.rituel.id === idRituel)
            .sort((a, b) => (parseInt(a.rituel.etape, 10) || 0) - (parseInt(b.rituel.etape, 10) || 0));
          setRituel(etapes.length > 1 ? etapes : []);
        } else {
          setRituel([]);
        }

        // Les autres senteurs de la même recette. Dérivées du nom, comme au
        // catalogue : rien n'est écrit, et une fiche renommée suit d'elle-même.
        const recette = lireRecette(foundProduct.name);
        if (recette) {
          const memeRecette = productsList
            .filter((p) => {
              const r = lireRecette(p.name);
              return r && r.cle === recette.cle;
            })
            .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
          // Une senteur seule n'est pas un choix : on n'affiche le sélecteur
          // que s'il y a réellement de quoi choisir.
          setSenteurs(memeRecette.length > 1 ? memeRecette.map((p) => ({ ...p, senteur: lireRecette(p.name).senteur })) : []);
        } else {
          setSenteurs([]);
        }

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
        // Une référence inconnue renvoyait à l'accueil sans un mot. Quelqu'un
        // qui ouvre un lien reçu par message se retrouvait sur la page
        // d'accueil et en concluait qu'il s'était trompé de lien — alors que
        // le produit avait simplement quitté le catalogue. Les liens de
        // produits vivent longtemps dans les messageries et les publications.
        setIntrouvable(true);
      }
    }
  }, [id]);

  useEffect(() => {
    const cible = blocAchatRef.current;
    if (!cible) return undefined;
    const observateur = new IntersectionObserver(
      ([entree]) => setBoutonVisible(entree.isIntersecting),
      { threshold: 0 }
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [product]);

  // Le message s'efface seul. La minuterie est nettoyée au démontage : quitter
  // la fiche entre-temps ferait écrire dans un composant parti.
  useEffect(() => {
    if (!ajoute) return undefined;
    const minuterie = setTimeout(() => setAjoute(false), 5000);
    return () => clearTimeout(minuterie);
  }, [ajoute]);

  // Le titre de l'onglet, la description et l'image de partage de cette fiche.
  // Appelé avant le retour anticipé ci-dessous : un hook ne peut pas être
  // conditionnel, et la fiche non chargée passe simplement des valeurs vides.
  useMetadonnees({
    titre: introuvable ? t('product.introuvableTitle') : (product ? product.name : ''),
    description: introuvable ? t('product.introuvableText') : (product ? product.description : ''),
    image: product && product.images && product.images[0]
      ? imageUrl(product.images[0], 1200)
      : '',
    type: 'product',
  });

  if (introuvable) {
    return (
      <div className="min-h-screen bg-mist-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-2xl sm:text-3xl text-slate-stone mb-4">
            {t('product.introuvableTitle')}
          </h1>
          <p className="font-sans font-light text-stone-gray leading-relaxed">
            {t('product.introuvableText')}
          </p>
          <Link
            to="/category/All"
            className="inline-block mt-8 px-8 py-3 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone/90 transition-colors press"
          >
            {t('product.introuvableBack')}
          </Link>
        </div>
      </div>
    );
  }

  if (!product) return <SqueletteFiche />;

  const isFavorite = favorites.some(p => p.id === product.id);

  // Le prix qu'on lit à l'écran. Quand la recharge est choisie, c'est celui de
  // la recharge — le même que le serveur facturera pour cette ligne.
  const rechargePossible = Number(product.rechargePrix) > 0;
  const prixCourant = enRecharge && rechargePossible ? Number(product.rechargePrix) : Number(product.price);
  
  // Use real images if available, otherwise fallback
  const images = product.images && product.images.length > 0 
    ? product.images 
    : [];   // aucune photo : on montre un cadre honnête, pas l'image d'une autre marque

  const handleAddToCart = () => {
    // In a real app we'd pass quantity, but for now we'll just add it multiple times or rely on the cart logic
    // Un seul appel avec la quantité : la boucle créait autant de lignes
    // identiques que d'unités, et chacune relançait l'animation du panier.
    // Le drapeau voyage avec la ligne : c'est lui qui dira au serveur quel
    // prix facturer, et c'est le serveur qui décidera si la fiche le permet.
    addToCart({ ...product, recharge: enRecharge, price: prixCourant }, quantity);
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
                    // `eager` : c'est le plus gros element de la page et ce
                    // qu'on vient voir. En « lazy », le navigateur attendait
                    // d'avoir fini sa mise en page pour le demander, si bien
                    // que le produit arrivait apres son propre cadre.
                    <ImageProduit
                      src={images[activeImage]}
                      alt={product.name}
                      largeur={1600}
                      eager
                      onClick={() => setVisionneuseOuverte(true)}
                      className="w-full h-full object-cover object-center cursor-zoom-in"
                    />
                  )}
                </div>
                
                {/* Thumbnails */}
                {images.length > 1 && (
                  // `Image 2 sur 4` plutot que « nom du produit 2 » : au lecteur
                  // d'ecran, l'ancien libelle ne disait pas ou l'on se trouvait
                  // dans la serie. Les fleches parcourent la galerie sans avoir
                  // a tabuler d'une vignette a l'autre.
                  <div
                    role="group"
                    aria-label={t('product.galleryLabel', { total: images.length })}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                      e.preventDefault();
                      const pas = e.key === 'ArrowRight' ? 1 : -1;
                      setActiveImage((i) => (i + pas + images.length) % images.length);
                    }}
                    className="flex gap-4 overflow-x-auto pb-2 hide-scrollbar"
                  >
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImage(idx)}
                        aria-label={t('product.imageOf', { n: idx + 1, total: images.length })}
                        aria-current={activeImage === idx}
                        className={`press w-20 h-24 flex-shrink-0 rounded-xl overflow-hidden border-2 ${activeImage === idx ? 'border-slate-stone opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
                      >
                        <img src={imageUrl(img, 400)} alt="" loading="lazy" className="w-full h-full object-cover" />
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
                  <p className="font-sans text-2xl text-stone-gray font-light">
                    {Number(product.price) > 0 ? `CHF ${prixCourant.toFixed(2)}` : t('catalog.onQuote')}
                  </p>
                  {/* La contenance appartient au prix : « CHF 24.00 » ne veut
                      rien dire tant qu'on ignore si c'est pour 30 ml ou 200. */}
                  {product.contenance && (
                    <span className="font-sans text-sm text-stone-gray/70">· {product.contenance}</span>
                  )}
                  {product.inStock === false && (
                    <span className="inline-block bg-red-100 text-red-700 text-xs tracking-widest uppercase px-3 py-1 rounded-full font-medium">
                      {t('catalog.outOfStock')}
                    </span>
                  )}
                </div>
              </div>

              {/* « Je rapporte mon flacon ».
                  Elle le fait déjà en boutique — son propre texte le dit : on
                  apporte ses flacons nettoyés, et le prix du contenant est
                  déduit. Ceci le met en ligne.

                  Les deux prix sont deux VARIANTES côté serveur, pas un rabais
                  affiché : la ligne porte un drapeau, et c'est le catalogue qui
                  donne le montant. Sans cela, « je rapporte le mien —
                  CHF 15.00 » débiterait le prix plein, et elle l'apprendrait
                  par une cliente mécontente plutôt que par un test. */}
              {rechargePossible && (
                <div className="mb-8">
                  <div className="inline-flex rounded-full border border-slate-stone/20 bg-ivory p-1">
                    {[false, true].map((mode) => (
                      <button
                        key={String(mode)}
                        type="button"
                        onClick={() => setEnRecharge(mode)}
                        aria-pressed={enRecharge === mode}
                        className={`press rounded-full px-5 py-2 font-sans text-xs ${
                          enRecharge === mode ? 'bg-slate-stone text-white' : 'text-slate-stone'
                        }`}
                      >
                        {mode ? t('product.refillMine') : t('product.refillNew')}
                        <span className={`ml-2 tabular-nums ${enRecharge === mode ? 'text-white/70' : 'text-stone-gray/60'}`}>
                          {(mode ? Number(product.rechargePrix) : Number(product.price)).toFixed(2)}
                        </span>
                      </button>
                    ))}
                  </div>
                  {enRecharge && (
                    <p className="mt-3 font-sans text-xs leading-relaxed text-stone-gray max-w-[55ch]">
                      {t('product.refillNote')}
                    </p>
                  )}
                </div>
              )}

              {/* L'orgue à parfums. Quinze senteurs d'un même savon occupaient
                  quinze fiches sans jamais se citer l'une l'autre : on tombait
                  sur « Vanilla Moon » sans savoir que « Lin Frais » existait.
                  Chaque pastille porte son propre prix, parce qu'elles
                  diffèrent — de CHF 5.20 à 11.60 — et qu'un prix unique
                  promettrait un montant que la caisse ne confirmerait pas. */}
              {senteurs.length > 1 && (
                <div className="mb-8">
                  <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-stone-gray/70 mb-3">
                    {t('product.scentsTitle', { n: senteurs.length })}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {senteurs.map((v) => {
                      const active = v.id === product.id;
                      return (
                        <Link
                          key={v.id}
                          to={`/product/${v.id}`}
                          aria-current={active}
                          className={`press rounded-full border px-4 py-2 font-sans text-xs ${
                            active
                              ? 'border-slate-stone bg-slate-stone text-white'
                              : 'border-slate-stone/20 text-slate-stone hover:border-slate-stone/50'
                          }`}
                        >
                          {v.senteur}
                          <span className={`ml-2 tabular-nums ${active ? 'text-white/70' : 'text-stone-gray/60'}`}>
                            {Number(v.price).toFixed(2)}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Sans prix fixe, il n'y a rien a mettre au panier : on
                  propose ce qui a du sens, une demande de devis. */}
              {Number(product.price) <= 0 && (
                <div ref={blocAchatRef}>
                  <Link
                    to="/personnalisation"
                    className="press inline-block rounded-full bg-slate-stone px-8 py-4 font-sans text-xs uppercase tracking-[0.2em] text-white"
                  >
                    {t('catalog.askForQuote')}
                  </Link>
                </div>
              )}

              {/* Add to Cart Actions */}
              {Number(product.price) > 0 && (
              <div ref={blocAchatRef} className="flex flex-col sm:flex-row gap-4">
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
              

              )}

              {/* Rupture de stock : un chemin, pas une impasse.
                  Le bouton devenait gris et le visiteur restait devant un mur.
                  On propose ici ce qui existe reellement : la boutique, qui
                  peut l'avoir en rayon meme quand la reserve en ligne est a
                  zero, et le produit le plus proche de la meme rubrique.

                  La condition reste `=== false`, JAMAIS `!product.inStock` :
                  huit fiches seulement portent ce champ en production, et la
                  forme relachee serait vraie pour les 171 autres — elle
                  desactiverait l'achat sur presque tout le catalogue sans que
                  rien ne le signale. */}
              {product.inStock === false && (
                <div className="mt-6 rounded-2xl border border-slate-stone/10 bg-ivory p-5">
                  <p className="font-sans text-sm text-slate-stone mb-1">{t('product.outOfStockTitle')}</p>
                  <p className="font-sans text-xs text-stone-gray leading-relaxed">
                    {t('product.outOfStockShop')}{' '}
                    <a href="tel:+41225566992" className="text-slate-stone underline underline-offset-2">022 556 69 92</a>
                  </p>
                  {relatedProducts[0] && (
                    <Link
                      to={`/product/${relatedProducts[0].id}`}
                      className="press mt-4 inline-block rounded-full border border-slate-stone/25 px-5 py-2 font-sans text-[10px] uppercase tracking-[0.18em] text-slate-stone hover:border-slate-stone/60"
                    >
                      {t('product.outOfStockNearest', { name: relatedProducts[0].name })}
                    </Link>
                  )}
                </div>
              )}

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
              {/* `max-w-none` supprimait la mesure que `prose` pose lui-même :
                  la description s'étalait sur toute la colonne, jusqu'à une
                  centaine de caractères par ligne, où l'œil perd le début de la
                  suivante en revenant à la marge. */}
              {product.description ? (
                <div
                  className="prose prose-sm prose-slate max-w-[65ch] font-sans font-light text-stone-gray leading-relaxed mb-10
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

              {/* Ce qu'il y a dans le flacon.
                  Replié : ces listes sont longues et ne se lisent pas d'un
                  bout à l'autre — on les ouvre pour vérifier un point précis.
                  Dépliées d'office, elles repousseraient la livraison et les
                  suggestions hors de l'écran.
                  Rien ne s'affiche tant qu'elle n'a rien saisi : un intitulé
                  vide vaudrait moins que son absence. */}
              {(product.ingredients || product.inci || (product.typePeau || []).length > 0 || (product.besoins || []).length > 0) && (
                <div className="mb-10 border-t border-slate-stone/10 pt-6">
                  {((product.typePeau || []).length > 0 || (product.besoins || []).length > 0) && (
                    <div className="mb-5 flex flex-wrap gap-2">
                      {[...(product.typePeau || []), ...(product.besoins || [])].map((etiquette, i) => (
                        <span key={i} className="rounded-full bg-ivory border border-slate-stone/10 px-3 py-1 font-sans text-[10px] uppercase tracking-[0.14em] text-stone-gray">
                          {etiquette}
                        </span>
                      ))}
                    </div>
                  )}

                  {product.ingredients && (
                    <details className="group border-b border-slate-stone/10 pb-3 mb-3">
                      <summary className="cursor-pointer list-none font-sans text-xs uppercase tracking-[0.18em] text-slate-stone marker:hidden">
                        {t('product.ingredientsTitle')}
                        <span className="float-right text-stone-gray/50 transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-3 max-w-[65ch] font-sans text-sm font-light leading-relaxed text-stone-gray whitespace-pre-line">
                        {product.ingredients}
                      </p>
                    </details>
                  )}

                  {product.inci && (
                    <details className="group">
                      <summary className="cursor-pointer list-none font-sans text-xs uppercase tracking-[0.18em] text-slate-stone marker:hidden">
                        {t('product.inciTitle')}
                        <span className="float-right text-stone-gray/50 transition-transform group-open:rotate-45">+</span>
                      </summary>
                      <p className="mt-3 max-w-[65ch] font-sans text-xs font-light leading-relaxed text-stone-gray/80 whitespace-pre-line">
                        {product.inci}
                      </p>
                    </details>
                  )}
                </div>
              )}

              {/* Shipping info — pas sur une fiche sans prix.
                  « Livraison offerte des CHF 150.- d'achat » n'a pas de sens
                  face a un produit sur devis : il n'y a pas de montant, et les
                  conditions d'envoi se discutent avec le devis lui-meme. */}
              {Number(product.price) > 0 && (
              <div className="mt-10 p-6 bg-ivory rounded-2xl border border-slate-stone/5 flex items-start gap-4">
                <IconeSimple nom="colis" className="w-6 h-6 shrink-0 text-slate-stone/60" />
                <div>
                  <h4 className="font-sans text-xs tracking-widest uppercase text-slate-stone font-bold mb-2">{t('product.shippingTitle')}</h4>
                  <p className="font-sans text-sm text-stone-gray font-light">{t('product.shippingText')}</p>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Le rituel complet.
            Il remplace « Vous aimerez aussi » quand il existe : proposer des
            suggestions calculées sous une suite d'étapes qu'elle a écrite
            elle-même serait mettre le hasard à côté de son intention.

            AUCUNE remise n'est annoncée. Le serveur additionne les prix du
            catalogue ; un « prix d'ensemble » remisé affiché ici sans code
            serveur ferait un total affiché inférieur au montant débité — le
            défaut des frais de port, rejoué sous une autre forme. */}
        {rituel.length > 1 && (
          <div className="container mx-auto px-6 lg:px-12 mt-24">
            <div className="rounded-3xl border border-slate-stone/[0.08] bg-ivory p-6 sm:p-10">
              <h3 className="font-serif text-2xl sm:text-3xl text-slate-stone mb-2">{t('product.ritualTitle')}</h3>
              <p className="font-sans text-sm text-stone-gray mb-8">
                {t('product.ritualLead', { n: rituel.length })}
              </p>

              <ol className="space-y-5 mb-8">
                {rituel.map((etape, i) => (
                  <li key={etape.id} className="flex gap-4 sm:gap-5">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-stone font-sans text-xs text-white tabular-nums">
                      {etape.rituel.etape || i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/product/${etape.id}`}
                        className={`font-sans text-sm hover:text-stone-gray transition-colors ${etape.id === product.id ? 'font-medium text-slate-stone' : 'text-slate-stone'}`}>
                        {etape.name}
                      </Link>
                      {etape.rituel.geste && (
                        <p className="font-sans text-xs font-light text-stone-gray leading-relaxed mt-0.5">
                          {etape.rituel.geste}
                        </p>
                      )}
                    </div>
                    <span className="font-sans text-sm text-stone-gray tabular-nums whitespace-nowrap">
                      CHF {(Number(etape.price) || 0).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ol>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-stone/10 pt-6">
                <p className="font-sans text-sm text-slate-stone tabular-nums">
                  {t('product.ritualTotal')}{' '}
                  <span className="font-medium">
                    CHF {rituel.reduce((n, e) => n + (Number(e.price) || 0), 0).toFixed(2)}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => {
                    // Un appel par produit, avec sa quantite : l'agregation
                    // posee en vague 1 fait qu'un rituel de trois articles
                    // donne trois lignes, pas neuf.
                    rituel.forEach((e) => addToCart(e, 1));
                    setAjoute(true);
                  }}
                  className="press rounded-full bg-slate-stone px-8 py-3.5 font-sans text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white"
                >
                  {t('product.ritualAdd', { n: rituel.length })}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Related Products */}
        {rituel.length <= 1 && relatedProducts.length > 0 && (
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

      {/* La barre d'achat collante, sous lg seulement.
          Elle partage litteralement `quantity` et `handleAddToCart` avec le bloc
          d'origine — ce sont les memes variables, pas une copie. Le plan
          avertit que deux declencheurs d'ajout qui ne partagent pas vraiment
          l'etat donnent un article la ou l'on en a demande trois ; ici le cas
          ne peut pas se produire.
          `env(safe-area-inset-bottom)` : sans lui, le bouton passe sous la
          barre d'accueil des iPhone recents. */}
      {!boutonVisible && product.inStock !== false && (
        <div
          className="fixed inset-x-0 bottom-0 z-[80] border-t border-slate-stone/10 bg-ivory/95 backdrop-blur-md lg:hidden"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-sans text-xs text-stone-gray">{product.name}</p>
              <p className="font-sans text-sm font-medium text-slate-stone tabular-nums">
                CHF {(product.price * quantity).toFixed(2)}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-stone/20 bg-mist-white px-3 py-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="-"
                className="press text-stone-gray hover:text-slate-stone"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4" /></svg>
              </button>
              <span className="min-w-4 text-center font-sans text-sm tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                aria-label="+"
                className="press text-stone-gray hover:text-slate-stone"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              className="press shrink-0 rounded-full bg-slate-stone px-6 py-3 font-sans text-[10px] uppercase tracking-[0.2em] text-white"
            >
              {t('product.addToCart')}
            </button>
          </div>
        </div>
      )}

      {/* Montee seulement quand elle est ouverte : fermee, elle n'existe pas,
          donc aucune surcouche ne peut rester au-dessus de la fiche. */}
      {visionneuseOuverte && images.length > 0 && (
        <VisionneuseImage
          images={images}
          indexInitial={activeImage}
          alt={product.name}
          onClose={() => setVisionneuseOuverte(false)}
        />
      )}
    </div>
  );
};

export default ProductPage;

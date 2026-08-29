import React, { useState, useEffect, useRef, useCallback } from 'react';
import Lien from './Lien';

import SectionHeader from './SectionHeader';
import { useLanguage } from '../i18n/LanguageContext';

import { getProducts, imageUrl, imageSrcSet } from '../services/products';
import { cheminProduit } from '../data/slug';
import { normaliserTexte } from '../data/texte';

// Drift speed in pixels per second. Slow enough to read a product name as it
// passes; any faster and the band becomes something you wait out rather than
// look at.
const DRIFT_PX_PER_SEC = 38;
// How long the drift stays out of the way after someone touches the carousel.
const RESUME_DELAY_MS = 2500;

const SignatureProducts = ({ addToCart, toggleFavorite, favorites }) => {
  const { t, tCategory } = useLanguage();
  const [productsList, setProductsList] = useState([]);

  useEffect(() => {
    let active = true;
    getProducts().then(data => { if (active) setProductsList(data); });
    return () => { active = false; };
  }, []);

  // The client chooses what appears here from the admin: adding the category
  // "Coup de coeur" to a product puts it in this section, and the order of the
  // list follows the order of the products. The hard-coded names below are only
  // a fallback for when nothing has been tagged yet, so the home page is never
  // empty.
  // Casse, accents, ligature et apostrophe : « Coup de cœur », « Coups de
  // coeur » et « COUP DE CŒUR » désignent la même chose. La règle vit dans
  // data/texte.js, partagée avec la recherche du catalogue.
  const normalise = normaliserTexte;

  const FEATURED_TAGS = ['coup de coeur', 'coups de coeur'];
  const tagged = productsList.filter(p =>
    (p.collections || []).some(c => FEATURED_TAGS.includes(normalise(c)))
  );

  // Une intention par ligne, six categories, de 14.90 a 39.90. L'ancienne
  // liste alignait six savons quasi identiques : la bande lisait comme du
  // remplissage plutot que comme un choix. Ceci ne s'affiche que tant que
  // rien n'est etiquete « Coup de coeur » — des qu'elle en etiquette un,
  // sa selection remplace celle-ci entierement.
  const fallbackNames = [
    "Coffret cadeau savon liquide Blue Linen lotion corporelleDragée", // 28.00 — coffret, le geste cadeau
    "Sels de Bain à l'huile essentielle de lavandin bio", // 27.50 — rituel de bain
    "'Oasis'- Crème anhydre peaux sèches", // 32.50 — soin visage haut de gamme
    "Eau de Parfum", // 39.90 — haut de la fourchette
    "Masque Visage Argile Rouge à l'extrait d'Echinacée et de Pivoine - 15 ml", // 15.00 — photo maison, pas Wix
    "Shampoings solide pour cheveux secs enrichi à l'huile d'avocat bio", // 15.00 — cheveux, zéro déchet
    "Stick lèvres naturel - cacao, coco, amande douce et cranberry", // 14.90 — entrée de gamme
    "Pochette découverte 5 savons", // 39.90 — ses savons, sans six tuiles jumelles
  ];
  const products = tagged.length > 0
    ? tagged
    : fallbackNames.map(name => productsList.find(p => p.name === name)).filter(Boolean);

  const trackRef = useRef(null);
  const pausedUntilRef = useRef(0);
  const holdRef = useRef(false);      // pointer is down, or the pointer is over the band
  const [hasOverflow, setHasOverflow] = useState(false);

  const pauseDrift = useCallback((ms = RESUME_DELAY_MS) => {
    pausedUntilRef.current = performance.now() + ms;
  }, []);

  // Exactly two copies of the list. The loop works by teleporting back by half
  // the track once we pass it — invisible, because the second half is identical
  // to the first. The previous version animated to -50% over *three* copies, so
  // the jump back landed mid-copy and the seam was plainly visible on every
  // cycle. Two copies is not a stylistic choice here; it is what makes the
  // arithmetic come out even.
  const loop = products.length > 0 ? [...products, ...products] : [];

  // Drift, wrap-around, and every reason to hold still, in one frame loop.
  // Writing scrollLeft ourselves (rather than a CSS transform) means the same
  // element can be dragged, swiped, wheeled and tabbed through — the browser's
  // own scrolling, so it behaves the way scrolling is expected to.
  useEffect(() => {
    const el = trackRef.current;
    if (!el || loop.length === 0) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let last = performance.now();

    const step = (now) => {
      const dt = Math.min(now - last, 100) / 1000; // ignore long gaps after a background tab
      last = now;

      const half = el.scrollWidth / 2;
      if (half > 0) {
        const moving = !reduced.matches
          && !holdRef.current
          && now >= pausedUntilRef.current
          && document.visibilityState === 'visible';
        if (moving) el.scrollLeft += DRIFT_PX_PER_SEC * dt;

        // Keep the position inside the first copy, whoever moved it — the
        // drift above, a swipe, or the arrows.
        if (el.scrollLeft >= half) el.scrollLeft -= half;
        else if (el.scrollLeft < 0) el.scrollLeft += half;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [loop.length]);

  // Arrows are only useful when there is something off-screen to reach.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const check = () => setHasOverflow(el.scrollWidth / 2 > el.clientWidth + 8);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [loop.length]);

  const nudge = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    // Hold the drift while the smooth scroll plays out, so the two do not
    // fight over scrollLeft.
    pauseDrift(900);
    el.scrollBy({ left: direction * Math.max(el.clientWidth * 0.8, 240), behavior: 'smooth' });
  };

  // Drag to pan. Native scrolling covers touch and trackpads, but not a mouse
  // drag — and the band showed a grab cursor while ignoring the mouse entirely.
  const dragRef = useRef(null);
  const onPointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    holdRef.current = true;
    dragRef.current = { x: e.clientX, left: trackRef.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 3) d.moved = true;
    trackRef.current.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    if (dragRef.current) pauseDrift();
    dragRef.current = null;
    holdRef.current = false;
  };
  // A drag that ends on a card must not also open that card.
  const onClickCapture = (e) => {
    if (dragRef.current?.moved) { e.preventDefault(); e.stopPropagation(); }
  };

  if (products.length === 0) return null;

  return (
    <section id="products" className="py-16 md:py-32 bg-mist-white overflow-hidden">
      <div className="container mx-auto px-6 md:px-12 mb-8 md:mb-16">
        <SectionHeader
          title={t('signature.title')}
          subtitle={t('signature.subtitle')}
          align="center"
        />
      </div>

      <div className="relative group/band">
        {/* The band runs edge to edge; these fades let cards leave the frame
            instead of being sliced off by it. */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 sm:w-24 bg-gradient-to-r from-mist-white to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 sm:w-24 bg-gradient-to-l from-mist-white to-transparent" />

        {hasOverflow && (
          <>
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label={t('signature.previous')}
              className="hidden md:flex absolute left-4 top-[38%] z-30 w-11 h-11 items-center justify-center rounded-full
                         bg-ivory/90 backdrop-blur-sm text-slate-stone shadow-md border border-slate-stone/10
                         opacity-0 group-hover/band:opacity-100 focus-visible:opacity-100
                         hover:bg-ivory press"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label={t('signature.next')}
              className="hidden md:flex absolute right-4 top-[38%] z-30 w-11 h-11 items-center justify-center rounded-full
                         bg-ivory/90 backdrop-blur-sm text-slate-stone shadow-md border border-slate-stone/10
                         opacity-0 group-hover/band:opacity-100 focus-visible:opacity-100
                         hover:bg-ivory press"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        <div
          ref={trackRef}
          className="flex overflow-x-auto hide-scrollbar cursor-grab active:cursor-grabbing select-none px-4"
          style={{ touchAction: 'pan-y pinch-zoom', overscrollBehaviorX: 'contain' }}
          onMouseEnter={() => { holdRef.current = true; }}
          onMouseLeave={() => { holdRef.current = false; endDrag(); }}
          onFocusCapture={() => pauseDrift(6000)}
          onWheel={() => pauseDrift()}
          onTouchStart={() => { holdRef.current = true; }}
          onTouchEnd={() => { holdRef.current = false; pauseDrift(); }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={onClickCapture}
        >
          {loop.map((product, index) => {
            // The second copy exists only to make the loop seamless. Screen
            // readers and the tab order must not meet every product twice.
            const isDuplicate = index >= products.length;
            return (
              <div
                key={index}
                className="w-[220px] sm:w-[280px] md:w-[330px] mx-3 shrink-0"
                aria-hidden={isDuplicate || undefined}
                inert={isDuplicate || undefined}
              >
                {/* The photography behind these cards comes from several different
                    shoots — some on white, some on black, some overhead in a
                    bowl — and side by side in one band they read as a jumble
                    rather than a collection. The hairline keeps the pale
                    packshots from dissolving into the page, and the wash below
                    pulls the extremes toward a common warmth. Neither is a
                    substitute for reshooting on one ground, but both stop the
                    band from looking accidental. */}
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-ivory mb-5
                                border border-slate-stone/[0.07] shadow-sm
                                hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 group/card">
                  {/* L'adresse passait ici telle qu'elle est stockée, sans
                      jamais traverser imageUrl : ni la bonne largeur, ni le
                      format négocié. C'était la seule bande du site dans ce
                      cas, et elle est sur l'accueil. */}
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={imageUrl(product.images[0], 800)}
                      srcSet={imageSrcSet(product.images[0], 800)}
                      sizes="(max-width: 640px) 70vw, (max-width: 1024px) 40vw, 25vw"
                      alt={product.name || ''}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="w-full h-full object-cover object-center absolute inset-0
                                 brightness-[1.02] saturate-[0.93]
                                 transition-transform duration-500 group-hover/card:scale-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-alpine-silver flex items-center justify-center p-8">
                      <div className="w-32 h-48 bg-gradient-to-tr from-white to-mist-blue/20 rounded-lg shadow-inner flex items-center justify-center opacity-80 border border-white/50">
                        <span className="font-serif text-slate-stone/40 text-4xl tracking-widest">SY</span>
                      </div>
                    </div>
                  )}

                  {/* No z-index: DOM order alone puts this above the image and below the
                      hover gradient that follows, so the overlay stays clean. */}
                  <div className="absolute inset-0 bg-[#B9A891]/[0.12] mix-blend-soft-light pointer-events-none" />

                  <Lien
                    to={cheminProduit(product)}
                    tabIndex={isDuplicate ? -1 : undefined}
                    className="absolute inset-0 z-0 bg-gradient-to-t from-slate-stone/40 via-transparent to-transparent
                               opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"
                  >
                    <span className="sr-only">{product.name}</span>
                  </Lien>

                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex space-x-3
                                  md:translate-y-8 md:opacity-0 md:group-hover/card:translate-y-0 md:group-hover/card:opacity-100
                                  focus-within:translate-y-0 focus-within:opacity-100
                                  transition-all duration-300 ease-out">
                    <button
                      type="button"
                      onClick={() => addToCart(product)}
                      tabIndex={isDuplicate ? -1 : undefined}
                      className="px-6 py-2 bg-white/90 backdrop-blur-sm text-slate-stone text-xs uppercase tracking-widest
                                 rounded-full font-medium hover:bg-slate-stone hover:text-white press"
                    >
                      {t('signature.add')}
                    </button>
                    {/* Le libellé portait « Ajouter aux favoris » sans dire
                        lequel : la bande en montre plusieurs à la fois, et un
                        lecteur d'écran répétait la même phrase de carte en
                        carte. Mêmes clefs que le catalogue. */}
                    <button
                      type="button"
                      onClick={() => toggleFavorite(product)}
                      tabIndex={isDuplicate ? -1 : undefined}
                      aria-label={t(
                        favorites.find(f => f.id === product.id)
                          ? 'catalog.ariaFavoriteRemove'
                          : 'catalog.ariaFavoriteAdd',
                        { name: product.name }
                      )}
                      aria-pressed={!!favorites.find(f => f.id === product.id)}
                      className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center
                                 hover:bg-slate-stone hover:text-white press"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" aria-hidden="true"
                           fill={favorites.find(f => f.id === product.id) ? 'currentColor' : 'none'}
                           viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col items-center text-center">
                  {/* Guarded: a product saved without a category used to throw
                      here and take the whole home page down with it. */}
                  <p className="text-xs uppercase tracking-widest text-mist-blue mb-2 font-medium">
                    {product.collections?.[0] ? tCategory(product.collections[0]) : t('catalog.cosmeticsFallback')}
                  </p>
                  <Lien to={cheminProduit(product)} tabIndex={isDuplicate ? -1 : undefined}>
                    <h3 className="font-serif text-base sm:text-lg md:text-xl text-slate-stone mb-1 line-clamp-1 px-4 hover:text-stone-gray transition-colors">
                      {product.name}
                    </h3>
                  </Lien>
                  <p className="font-sans text-sm text-stone-gray">CHF {Number(product.price || 0).toFixed(2)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default SignatureProducts;

import React, { useState, useEffect, useRef, useMemo } from 'react';
import Lien from './Lien';
import { useLocation, useSearchParams } from 'react-router-dom';
import SectionHeader from './SectionHeader';
import { getProducts, imageUrl, imageSrcSet } from '../services/products';
import { useLanguage } from '../i18n/LanguageContext';
import { visibleCategories, cheminRubrique } from '../data/categories';
import { cheminProduit } from '../data/slug';
import { ouvrirPanier, sursautPanier } from '../services/panier';
import { TRANCHES_PRIX, dansLaTranche, trier, TRIS } from '../data/tri';
import { grouperParRecette } from '../data/recettes';
import { normaliserTexte } from '../data/texte';
import ProductBadge from './ProductBadge';
import ProductPlaceholder from './ProductPlaceholder';


// Chaque tranche porte son libelle traduit ; la regle de bornes, elle, vit
// dans data/tri.js pour que le compteur et la grille lisent la meme chose.
const LIBELLES_TRANCHES = { moins15: 'priceUnder', '15a30': 'price15to30', '30a60': 'price30to60', plus60: 'priceOver' };

// Casse, accents, ligature et apostrophe : la comparaison vit dans data/texte.js
// pour que la recherche et la bande « coup de cœur » lisent la même règle. Elle
// ignorait ici la ligature et l'apostrophe — « coeur » ne trouvait pas « cœur ».
const normalizeText = normaliserTexte;

// Remove HTML tags from descriptions so we match words, not markup.
const stripHtml = (s) => (s || '').toString().replace(/<[^>]*>/g, ' ');

// Le nombre de fiches montrées en aperçu sur l'accueil.
//
// Huit : deux rangées pleines sur les grilles de quatre, quatre sur celles de
// deux. Aucune rangée ne reste bancale, quelle que soit la largeur.
const APERCU = 8;

// La taille d'une page, et la première tranche montrée hors pagination.
//
// Les deux DOIVENT être le même nombre. La tranche initiale valait douze
// pendant que la pagination comptait par vingt-quatre : le lien « page 1 »
// menait à l'adresse nue, qui en montrait douze, tandis que « page 2 »
// commençait au vingt-cinquième. Les produits 13 à 24 n'apparaissaient alors
// dans aucune page atteignable — douze fiches par rubrique invisibles à qui
// suit les liens plutôt que le plan du site.
const PAS = 24;

// `apercu` : l'accueil montre un échantillon, pas la boutique.
//
// Le catalogue complet y était monté tel quel, avec son défilement infini —
// un observateur qui ajoute douze fiches dès qu'on atteint le bas. Sur 178
// produits, la page d'accueil ne se terminait donc jamais, et tout ce qui
// vient après (les engagements, les ateliers, le pied de page) était en
// pratique hors d'atteinte : on n'y arrivait qu'en épuisant le catalogue.
//
// En aperçu, le nombre est fixe, l'observateur n'est pas posé, et le pied
// renvoie à la boutique au lieu d'en charger davantage.
function Catalog({ globalActiveCategory = 'All', addToCart, toggleFavorite, favorites, searchQuery = '', apercu = false, sansEntete = false }) {
  const { t, tCategory } = useLanguage();
  const [productsList, setProductsList] = useState([]);
  const [activeCategory, setActiveCategory] = useState(globalActiveCategory);
  // Distinguer « le catalogue n'est pas encore arrive » de « la rubrique est
  // vide ». Sans ce drapeau, la page affichait « Aucun produit dans cette
  // categorie » pendant tout le chargement, sur toutes les rubriques.
  const [charge, setCharge] = useState(false);
  // Quelle carte vient de recevoir un ajout. Le seul retour etait un chiffre
  // qui changeait dans l'en-tete, hors du champ de vision sur mobile : on
  // touchait le bouton, et rien ne se passait la ou on regardait.
  const [ajouteId, setAjouteId] = useState(null);

  // Le tri et les fourchettes vivent dans l'adresse, pas dans le composant.
  // Un lien de resultats se colle alors dans une conversation, et le retour
  // arriere du navigateur retrouve la selection au lieu de la perdre.
  const [parametres, setParametres] = useSearchParams();
  const { pathname } = useLocation();
  const tri = TRIS.includes(parametres.get('tri')) ? parametres.get('tri') : 'boutique';
  const tranchesChoisies = (parametres.get('prix') || '')
    .split(',')
    .filter((id) => TRANCHES_PRIX.some((t) => t.id === id));
  // Sa forme stable : le tableau est reconstruit a chaque rendu, la chaine non.
  const clePrix = tranchesChoisies.join(',');

  const majParametres = (patch) => {
    const suivant = new URLSearchParams(parametres);
    for (const [cle, valeur] of Object.entries(patch)) {
      if (!valeur) suivant.delete(cle);
      else suivant.set(cle, valeur);
    }
    // `replace` : chaque clic sur une pastille n'a pas a creer une entree
    // d'historique, sinon revenir en arriere oblige a defaire filtre par filtre.
    setParametres(suivant, { replace: true });
  };

  const basculerTranche = (id) => {
    const suivantes = tranchesChoisies.includes(id)
      ? tranchesChoisies.filter((x) => x !== id)
      : [...tranchesChoisies, id];
    majParametres({ prix: suivantes.join(',') });
  };
  // « Dans la rubrique Cadeaux, j'aimerais également intégrer les ateliers. »
  // Un atelier est un cadeau qu'on offre comme un produit ; il n'a simplement
  // pas de panier. Chargés séparément puisqu'ils ne vivent pas au catalogue.
  const [workshops, setWorkshops] = useState([]);
  useEffect(() => {
    let actif = true;
    fetch('/api/workshops')
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => { if (actif) setWorkshops(Array.isArray(d) ? d : []); })
      .catch(() => {});
    return () => { actif = false; };
  }, []);
  const [visibleCount, setVisibleCount] = useState(apercu ? APERCU : PAS);
  const scrollRef = useRef(null);
  const isSearching = searchQuery.trim().length > 0;

  // Troisième endroit où les rubriques étaient écrites en dur, après les deux
  // menus. Celui-ci affichait encore l'ancienne liste alors que les menus
  // montraient déjà la nouvelle — exactement la divergence que la source unique
  // devait empêcher, et que seul un coup d'œil à la page en ligne a révélée.
  const categories = ['All', ...visibleCategories(productsList)];

  useEffect(() => {
    let active = true;
    getProducts()
      .then(data => { if (active) setProductsList(Array.isArray(data) ? data : []); })
      .catch(() => {})
      // Egalement en cas d'echec : sinon les squelettes tournent indefiniment
      // au lieu de dire que le catalogue n'a pas pu etre lu.
      .finally(() => { if (active) setCharge(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setActiveCategory(globalActiveCategory);
  }, [globalActiveCategory]);

  // Le filtrage est un calcul, pas un effet.
  //
  // Il vivait dans un setTimeout de 150 ms suivi d'un second de 50 ms : changer
  // de rubrique faisait disparaitre la grille, attendre, puis reapparaitre.
  // Deux dixiemes de seconde de vide pour un tri qui prend moins d'une
  // milliseconde sur 178 produits — la minuterie ne masquait aucun travail,
  // elle en fabriquait l'apparence. Ici le resultat est pret au rendu suivant.
  const displayedProducts = useMemo(() => {
    let filtered = productsList;
    const terms = normalizeText(searchQuery).split(/\s+/).filter(Boolean);
    if (terms.length) {
      // A product matches when every search word appears (accent-insensitive)
      // somewhere in its name, description or categories — in any order.
      filtered = productsList.filter(p => {
        const haystack = normalizeText(
          `${p.name || ''} ${stripHtml(p.description || '')} ${(p.collections || []).join(' ')}`
        );
        return terms.every(t => haystack.includes(t));
      });
    } else if (activeCategory !== 'All') {
      filtered = productsList.filter(p => p.collections && p.collections.includes(activeCategory));
    }

    // Les ateliers rejoignent les Cadeaux, presentes comme les produits mais
    // menant a leur page dediee : ils se reservent, ils ne s'ajoutent pas au
    // panier.
    if (activeCategory === 'Cadeaux' && workshops.length > 0) {
      filtered = [
        ...workshops.map((w) => ({
          id: w.id,
          name: w.title || '',
          price: Number(w.price) || 0,
          images: w.image_url ? [w.image_url] : [],
          collections: ['Cadeaux'],
          ribbon: null,
          estAtelier: true,
        })),
        ...filtered,
      ];
    }

    // L'orgue a parfums. Quinze savons « olive, coco, ricin, palme RSPO »
    // occupaient quinze cartes identiques a la photo pres : ce n'est pas quinze
    // savons, c'est un savon en quinze senteurs. Le regroupement vient AVANT
    // les filtres et le tri, pour que le compte affiche porte sur les cartes
    // reellement montrees.
    filtered = grouperParRecette(filtered);

    // Les fourchettes de prix, puis le tri. Dans cet ordre : trier ce qu'on
    // s'apprete a jeter serait du travail perdu, et le compte affiche doit
    // porter sur ce qui est reellement montre.
    if (tranchesChoisies.length > 0) {
      const retenues = TRANCHES_PRIX.filter((t) => tranchesChoisies.includes(t.id));
      filtered = filtered.filter((p) => retenues.some((t) => dansLaTranche(p.price, t)));
    }

    return trier(filtered, tri);
    // `tranchesChoisies` est reconstruit a chaque rendu depuis l'adresse : on
    // depend de sa forme stable, la chaine, et non du tableau.
  }, [productsList, workshops, activeCategory, searchQuery, tri, clePrix]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ajouteId) return undefined;
    const minuterie = setTimeout(() => setAjouteId(null), 4000);
    return () => clearTimeout(minuterie);
  }, [ajouteId]);

  // « Voir plus » repart de douze des que la rubrique ou la recherche change.
  //
  // C'etait fait au milieu du filtrage, donc a chaque rendu : le compteur
  // retombait a douze des qu'autre chose bougeait sur la page. Passer par un
  // effet marcherait, mais peindrait la grille deux fois — une fois avec
  // l'ancien compteur, une fois avec le bon. L'ajustement pendant le rendu est
  // ce que React recommande pour un etat qui derive d'un changement de selection.
  const selection = `${activeCategory}|${searchQuery}|${tri}|${clePrix}`;
  const [selectionPeinte, setSelectionPeinte] = useState(selection);
  if (selectionPeinte !== selection) {
    setSelectionPeinte(selection);
    setVisibleCount(apercu ? APERCU : PAS);
  }

  const loadMore = () => setVisibleCount((prev) => prev + PAS);

  // Des adresses de pages, pour que les 178 fiches soient atteignables.
  //
  // Le catalogue n'affichait que douze produits, puis attendait un défilement
  // ou un clic. Un robot ne fait ni l'un ni l'autre : il voyait douze fiches
  // par rubrique, et aucune adresse ne menait aux suivantes. Le plan du site
  // les liste désormais toutes, mais un plan n'est qu'une déclaration — un
  // chemin de liens reste ce qui distribue la valeur entre les pages.
  //
  // Strictement additif : sans « ?page », rien ne change. Avec, on affiche
  // exactement cette tranche-là, et le chargement au défilement se retire —
  // deux mécanismes qui empileraient des produits en même temps donneraient
  // des pages qui se recouvrent, donc du contenu dupliqué.
  const enPages = !apercu && parametres.has('page');
  const nbPages = Math.max(1, Math.ceil(displayedProducts.length / PAS));
  const page = Math.min(Math.max(1, parseInt(parametres.get('page'), 10) || 1), nbPages);
  const produitsAffiches = enPages
    ? displayedProducts.slice((page - 1) * PAS, page * PAS)
    : displayedProducts.slice(0, visibleCount);

  // L'adresse d'une page, en conservant le tri et les fourchettes en cours.
  //
  // Le chemin courant porte déjà son préfixe de langue ; <Lien> le retire avant
  // de le reposer, l'opération est donc neutre ici, et le lien reste dans la
  // langue de la page.
  const lienPage = (n) => {
    const p = new URLSearchParams(parametres);
    if (n <= 1) p.delete('page'); else p.set('page', String(n));
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  };

  // Le chargement au defilement. La sentinelle est placee sous la grille : des
  // qu'elle entre dans le champ, la tranche suivante arrive.
  //
  // Le bouton « Voir plus » RESTE, et ce n'est pas une redondance : si
  // l'observateur ne tire pas — mouvement reduit, navigateur ancien, onglet qui
  // ne peint pas — le catalogue resterait bloque a douze articles sans que rien
  // ne l'explique. Le bouton est le chemin qui ne peut pas echouer.
  const sentinelleRef = useRef(null);
  useEffect(() => {
    const cible = sentinelleRef.current;
    if (apercu || !cible) return undefined;
    const observateur = new IntersectionObserver(
      ([entree]) => { if (entree.isIntersecting) setVisibleCount((n) => n + PAS); },
      { rootMargin: '400px 0px' } // on charge avant d'arriver au bout
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [displayedProducts.length, visibleCount, apercu]);

  // Le ruban de rubriques, tire a la souris.
  //
  // Deux defauts : le deplacement etait multiplie par 2, donc le point saisi
  // filait deux fois plus vite que la main et glissait sous le curseur ; et
  // relacher apres avoir fait defiler declenchait le clic du bouton survole,
  // changeant de rubrique alors qu'on voulait seulement faire defiler.
  //
  // Le tactile est laisse au navigateur : `overflow-x-auto` lui donne deja
  // l'inertie et le rebond en fin de course, que rien d'ecrit ici n'egalerait.
  const glisse = useRef(null);
  const glissementRecent = useRef(false);
  const SEUIL_GLISSE = 6; // en deca, c'est le tremblement d'un clic, pas un geste

  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = scrollRef.current;
    if (!el) return;
    // Un nouveau geste efface le precedent : sinon un glissement relache dans
    // le vide laisserait le drapeau leve et avalerait le clic suivant.
    glissementRecent.current = false;
    glisse.current = { id: e.pointerId, departX: e.clientX, departScroll: el.scrollLeft, bouge: false };
  };

  const onPointerMove = (e) => {
    const g = glisse.current;
    const el = scrollRef.current;
    if (!g || !el || e.pointerId !== g.id) return;
    const ecart = e.clientX - g.departX;
    if (!g.bouge) {
      if (Math.abs(ecart) < SEUIL_GLISSE) return;
      g.bouge = true;
      // Capture prise seulement une fois le seuil franchi : avant, le clic doit
      // continuer d'atteindre normalement le bouton vise.
      try { el.setPointerCapture(g.id); } catch { /* pointeur deja parti */ }
    }
    e.preventDefault();
    // Facteur 1 : le point saisi reste sous le curseur.
    el.scrollLeft = g.departScroll - ecart;
  };

  const onPointerUp = (e) => {
    const g = glisse.current;
    const el = scrollRef.current;
    if (!g || e.pointerId !== g.id) return;
    if (g.bouge && el) {
      try { el.releasePointerCapture(g.id); } catch { /* deja relachee */ }
    }
    glissementRecent.current = g.bouge;
    glisse.current = null;
  };

  return (
    <section id="catalog" className="py-24 bg-mist-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* « sansEntete » : la page de rubrique pose désormais son propre
            <h1>, et cet en-tête-ci répétait « Découvrez So You » juste en
            dessous — le même sur quatorze pages. Il reste sur l'accueil, où
            il est le titre de la section, et pendant une recherche, où il
            annonce le nombre de résultats. */}
        {(!sansEntete || isSearching) && (
          <SectionHeader
            title={isSearching ? t('catalog.titleSearch') : t('catalog.titleFull')}
            subtitle={isSearching
              ? t('catalog.resultCount', { n: displayedProducts.length, q: searchQuery.trim() })
              : t('catalog.subtitleFull')}
          />
        )}

        {/* Categories Filter — hidden while searching */}
        {!isSearching && (
        <div className="mt-12 mb-16 relative">
          <div 
            ref={scrollRef}
            className="flex space-x-4 overflow-x-auto pb-4 hide-scrollbar cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* Les pastilles changent l'adresse, elles ne filtrent plus sur
                place.
                Avant, cliquer « Savons » sur /category/All remplaçait la grille
                sans toucher à l'adresse : la rubrique n'avait donc aucune URL
                qu'on puisse partager, mettre en favori, ou atteindre depuis un
                lien — et /category/All servait treize contenus différents selon
                un état invisible. Les treize rubriques n'étaient liées de nulle
                part, sauf du fil d'Ariane d'une fiche, elle-même atteignable
                seulement depuis une rubrique. */}
            {categories.map((category) => (
              <Lien
                key={category}
                to={cheminRubrique(category)}
                onClick={(e) => {
                  // On vient de faire defiler le ruban : ce relachement n'est
                  // pas un choix de rubrique.
                  if (glissementRecent.current) {
                    glissementRecent.current = false;
                    e.preventDefault();
                  }
                }}
                className={`whitespace-nowrap px-6 py-3 rounded-full text-sm tracking-widest uppercase transition-all duration-300 border ${
                  activeCategory === category
                  ? 'bg-slate-stone text-white border-slate-stone shadow-lg'
                  : 'bg-transparent text-slate-stone border-slate-stone/20 hover:border-slate-stone/50 hover:bg-slate-stone/5'
                }`}
              >
                {tCategory(category)}
              </Lien>
            ))}
          </div>
          {/* Subtle gradient fades for scroll indication */}
          <div className="absolute top-0 right-0 h-full w-16 bg-gradient-to-l from-mist-white to-transparent pointer-events-none"></div>
          <div className="absolute top-0 left-0 h-full w-16 bg-gradient-to-r from-mist-white to-transparent pointer-events-none"></div>
        </div>
        )}

        {/* La barre d'outils : compter, trier, borner le prix.
            Le compte est une affirmation verifiable — s'il diverge du nombre de
            cartes rendues, cela se voit. Il n'est donc calcule que sur ce qui
            est reellement montre, apres filtres, et n'apparait qu'une fois le
            catalogue arrive : annoncer « 0 produit » pendant le chargement
            serait faux. */}
        {charge && (
          <div className="mb-8 flex flex-col gap-4 border-b border-slate-stone/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-sans text-sm text-stone-gray tabular-nums">
              {t(displayedProducts.length === 1 ? 'catalog.countProduct' : 'catalog.countProducts', { n: displayedProducts.length })}
            </p>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-stone-gray/60">
                  {t('catalog.priceLabel')}
                </span>
                {TRANCHES_PRIX.map((tranche) => {
                  const choisie = tranchesChoisies.includes(tranche.id);
                  return (
                    <button
                      key={tranche.id}
                      type="button"
                      onClick={() => basculerTranche(tranche.id)}
                      aria-pressed={choisie}
                      className={`press rounded-full border px-3 py-1.5 font-sans text-xs ${
                        choisie
                          ? 'border-slate-stone bg-slate-stone text-white'
                          : 'border-slate-stone/20 text-slate-stone hover:border-slate-stone/50'
                      }`}
                    >
                      {t(`catalog.${LIBELLES_TRANCHES[tranche.id]}`)}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2">
                <span className="font-sans text-[10px] uppercase tracking-[0.18em] text-stone-gray/60">
                  {t('catalog.sortLabel')}
                </span>
                <select
                  value={tri}
                  onChange={(e) => majParametres({ tri: e.target.value === 'boutique' ? '' : e.target.value })}
                  className="rounded-full border border-slate-stone/20 bg-transparent px-3 py-1.5 font-sans text-xs text-slate-stone focus:outline-none focus:border-slate-stone/50"
                >
                  <option value="boutique">{t('catalog.sortShop')}</option>
                  <option value="prixCroissant">{t('catalog.sortPriceUp')}</option>
                  <option value="prixDecroissant">{t('catalog.sortPriceDown')}</option>
                  <option value="alpha">{t('catalog.sortAlpha')}</option>
                </select>
              </label>

              {(tranchesChoisies.length > 0 || tri !== 'boutique') && (
                <button
                  type="button"
                  onClick={() => majParametres({ prix: '', tri: '' })}
                  className="press font-sans text-xs text-stone-gray underline underline-offset-4 hover:text-slate-stone"
                >
                  {t('catalog.clearFilters')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Douze squelettes a la geometrie exacte des cartes : la page garde sa
            hauteur et sa forme, et le catalogue s'y substitue sans que rien ne
            saute. Un simple « Chargement... » aurait fait bondir toute la page
            au moment de l'arrivee des produits. */}
        {!charge && (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8" aria-hidden="true">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex flex-col bg-ivory rounded-xl sm:rounded-2xl overflow-hidden shadow-sm">
                <div className="aspect-[4/5] w-full bg-lake-mist animate-pulse" />
                <div className="p-3 sm:p-6 flex flex-col flex-grow">
                  <div className="mb-2">
                    <p className="text-[9px] sm:text-xs uppercase tracking-widest mb-0.5 sm:mb-1">
                      <span className="inline-block w-1/3 rounded bg-lake-mist animate-pulse">&nbsp;</span>
                    </p>
                    <h3 className="text-sm sm:text-lg font-serif leading-tight">
                      <span className="inline-block w-4/5 rounded bg-lake-mist animate-pulse">&nbsp;</span>
                      <span className="inline-block w-3/5 rounded bg-lake-mist animate-pulse mt-0.5">&nbsp;</span>
                    </h3>
                  </div>
                  <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between border-t border-slate-stone/10">
                    <p className="text-xs sm:text-base">
                      <span className="inline-block w-16 rounded bg-lake-mist animate-pulse">&nbsp;</span>
                    </p>
                    <span className="inline-block h-4 w-12 rounded bg-lake-mist animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Products Grid — la cle force une entree neuve a chaque rubrique et a
            chaque recherche, ce qui remplace l'ancienne cascade de retards. */}
        {charge && (
        <div key={selection} className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          {produitsAffiches.map((product) => {
            const sansPhoto = !product.images || product.images.length === 0;
            // Un atelier mène à sa page de réservation, pas à une fiche produit.
            const lien = product.estAtelier ? `/workshops/${product.id}` : cheminProduit(product);
            return (
              // `apparait` remplace `reveal` : l'observateur d'intersection
              // n'a rien a observer ici, la grille est deja sous les yeux quand
              // on change de rubrique. Et la cascade de 100 ms par carte faisait
              // attendre 1,1 s la troisieme rangee — un retard, pas une elegance.
              <div
                key={product.id}
                className="group relative flex flex-col bg-ivory rounded-xl sm:rounded-2xl overflow-hidden shadow-sm hover:shadow-2xl transition-shadow duration-250 apparait"
              >
                <div className="aspect-[4/5] w-full overflow-hidden bg-lake-mist relative">
                  {/* `sizes` décrit la grille : deux colonnes sur téléphone,
                      trois puis quatre ensuite. Sans lui, le navigateur suppose
                      que l'image occupe toute la largeur et prend la plus
                      grande du lot — soit, sur une carte de 180 px, huit fois
                      les octets utiles. */}
                  {sansPhoto ? <ProductPlaceholder /> : (
                  <img
                    src={imageUrl(product.images[0], 800)}
                    srcSet={imageSrcSet(product.images[0], 800)}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover object-center transform group-hover:scale-105 transition-transform duration-700 ease-in-out"
                  />
                  )}
                  {product.ribbon && (
                    <div className="absolute top-2 left-2 sm:top-4 sm:left-4 z-10">
                      <ProductBadge ribbon={product.ribbon} />
                    </div>
                  )}
                  {product.inStock === false && (
                    <div className="absolute top-2 right-2 sm:top-4 sm:right-4 z-10">
                      <span className="inline-block bg-red-600/95 text-white text-[9px] sm:text-xs tracking-widest uppercase px-2 py-1 sm:px-3 sm:py-1.5 rounded-full shadow-sm font-medium">
                        {t('catalog.outOfStock')}
                      </span>
                    </div>
                  )}
                  {/* Hover Overlay — on mobile the card image is directly tappable */}
                  <Lien to={lien} className="absolute inset-0 bg-slate-stone/10 opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center md:backdrop-blur-[2px]">
                    <span className="transform translate-y-4 md:group-hover:translate-y-0 opacity-0 md:group-hover:opacity-100 transition-all duration-250 bg-ivory text-slate-stone px-8 py-3 rounded-full font-medium tracking-wide shadow-lg hover:bg-slate-stone hover:text-white hidden md:inline">
                      {t('catalog.viewDetails')}
                    </span>
                  </Lien>
                </div>
                
                <div className="p-3 sm:p-6 flex flex-col flex-grow">
                  <div className="mb-2">
                    <p className="text-[9px] sm:text-xs text-slate-stone/60 uppercase tracking-widest mb-0.5 sm:mb-1 truncate">
                      {product.collections[0] ? tCategory(product.collections[0]) : t('catalog.cosmeticsFallback')}
                    </p>
                    <Lien to={lien}>
                      <h3 className="text-sm sm:text-lg font-serif text-slate-stone leading-tight line-clamp-2 hover:text-stone-gray transition-colors">
                        {product.name}
                      </h3>
                    </Lien>
                    {/* Le nombre de senteurs, pas la liste : sur une carte de
                        catalogue, quinze noms de parfums ne se lisent pas. */}
                    {product.estRecette && (
                      <p className="mt-1 font-sans text-[10px] sm:text-xs text-stone-gray/70">
                        {t('catalog.scentCount', { n: product.membres.length })}
                      </p>
                    )}
                  </div>
                  <div className="mt-auto pt-2 sm:pt-4 flex items-center justify-between border-t border-slate-stone/10">
                    {/* Quatre fiches du catalogue sont a CHF 0 : les trois
                        « Collection » et « Commande personnalisee ». Elles ne
                        valent pas zero franc, elles n'ont pas de prix fixe —
                        c'est le « sur devis » de son propre texte. Affiche
                        « CHF 0.00 », on pouvait les commander pour le seul prix
                        du port. */}
                    <p className="text-slate-stone text-xs sm:text-base font-medium tracking-wide">
                      {/* « des CHF X » quand les senteurs d'une meme recette
                          n'ont pas le meme prix. Afficher un prix unique
                          promettrait un montant que la caisse ne confirmerait
                          pas : le serveur facture par identifiant. */}
                      {Number(product.price) > 0
                        ? (product.prixVariable
                            ? t('catalog.fromPrice', { price: product.price.toFixed(2) })
                            : `CHF ${product.price.toFixed(2)}`)
                        : t('catalog.onQuote')}
                    </p>
                    <div className="flex space-x-2 sm:space-x-3">
                      {/* Un bouton qui ne contient qu'une icône n'a pas de nom :
                          un lecteur d'écran annonce « bouton », et rien d'autre.
                          Le nom porte celui du produit, parce que la page en
                          répète douze identiques. */}
                      <button
                        onClick={() => toggleFavorite(product)}
                        aria-label={t(
                          favorites.find(f => f.id === product.id)
                            ? 'catalog.ariaFavoriteRemove'
                            : 'catalog.ariaFavoriteAdd',
                          { name: product.name }
                        )}
                        aria-pressed={!!favorites.find(f => f.id === product.id)}
                        className={`transition-colors duration-200 ${favorites.find(f => f.id === product.id) ? 'text-red-400' : 'text-slate-stone/60 hover:text-red-400'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill={favorites.find(f => f.id === product.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </button>
                      {/* Un atelier se réserve, il ne s'ajoute pas au panier :
                          le bouton n'aurait mené qu'à une impasse. */}
                      {!product.estAtelier && !product.estRecette && Number(product.price) > 0 && (
                      <button
                        onClick={(e) => {
                          if (product.inStock === false) return;
                          sursautPanier(e.currentTarget);
                          addToCart(product);
                          setAjouteId(product.id);
                        }}
                        disabled={product.inStock === false}
                        aria-label={t('catalog.ariaAddToCart', { name: product.name })}
                        className={`transition-all duration-300 ${product.inStock === false ? 'text-slate-stone/20 cursor-not-allowed' : 'text-slate-stone/60 hover:text-slate-stone'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                      </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ce qui vient de se passer, la ou l'on regarde : sur le bouton
                    qu'on vient de toucher, et non dans l'en-tete. */}
                {ajouteId === product.id && (
                  <div
                    role="status"
                    className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 bg-slate-stone/95 px-3 py-2 text-[10px] sm:text-xs text-white apparait"
                  >
                    <span className="truncate">{t('product.addedToCart')}</span>
                    <button
                      type="button"
                      onClick={ouvrirPanier}
                      className="press whitespace-nowrap underline underline-offset-2 hover:text-white/80 transition-colors"
                    >
                      {t('product.seeCart')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* Etat vide — seulement une fois le catalogue arrive. Avant, ce message
            s'affichait pendant tout le chargement, sur toutes les rubriques. */}
        {charge && displayedProducts.length === 0 && (
          <div className="text-center py-24">
            <p className="text-slate-stone/60 text-lg">
              {isSearching ? t('catalog.emptySearch', { q: searchQuery.trim() }) : t('catalog.emptyCategory')}
            </p>
          </div>
        )}

        {/* La sentinelle du chargement au defilement. */}
        {charge && !enPages && visibleCount < displayedProducts.length && (
          <div ref={sentinelleRef} aria-hidden="true" className="h-px w-full" />
        )}

        {/* Les pages, en vrais liens.
            Rendues même en page 1 : c'est de là qu'un robot doit trouver le
            chemin vers les cent soixante fiches suivantes. Discrètes à dessein
            — pour un visiteur, « Voir plus » reste le geste naturel, et ces
            liens ne sont là que pour ceux qui ne cliquent pas. */}
        {charge && !apercu && !isSearching && nbPages > 1 && (
          <nav aria-label={t('catalog.pagination')} className="mt-16">
            <ol className="flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: nbPages }, (_, i) => i + 1).map((n) => (
                <li key={n}>
                  <Lien
                    to={lienPage(n)}
                    aria-label={t('catalog.pageLabel', { n })}
                    aria-current={enPages && n === page ? 'page' : undefined}
                    className={`inline-flex items-center justify-center min-w-9 h-9 px-3 rounded-full text-xs tracking-widest border press transition-colors ${
                      (enPages ? n === page : n === 1)
                        ? 'bg-slate-stone text-white border-slate-stone font-medium'
                        : 'text-stone-gray border-slate-stone/15 hover:border-slate-stone/40 hover:text-slate-stone'
                    }`}
                  >
                    {n}
                  </Lien>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* En aperçu, le pied renvoie à la boutique : c'est ce qui donne une
            fin à la page d'accueil. Ailleurs, il charge la suite. */}
        {apercu && visibleCount < displayedProducts.length && (
          <div className="mt-16 text-center">
            <Lien
              to="/category/All"
              className="inline-block border-b border-slate-stone text-slate-stone tracking-widest uppercase text-sm pb-1 hover:text-slate-stone/70 hover:border-slate-stone/70 press"
            >
              {t('catalog.seeAll')}
            </Lien>
          </div>
        )}

        {!apercu && !enPages && visibleCount < displayedProducts.length && (
          <div className="mt-16 text-center">
            <button
              onClick={loadMore}
              className="inline-block border-b border-slate-stone text-slate-stone tracking-widest uppercase text-sm pb-1 hover:text-slate-stone/70 hover:border-slate-stone/70 press"
            >
              {t('catalog.loadMore')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default Catalog;

import React, { useState, useEffect } from 'react';
import { separerLangue } from '../i18n/routes';
import Lien from './Lien';
import useLienLangue from '../i18n/useLienLangue';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileMenu from './MobileMenu';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';
import { visibleCategories, cheminRubrique } from '../data/categories';
import { getProducts } from '../services/products';
import useVerrouDefilement from '../hooks/useVerrouDefilement';

// Maps the routing keys used by onCategorySelect/isLinkActive to translation keys.
const NAV_LABELS = { 'About Us': 'nav.about', Workshops: 'nav.workshops', Journal: 'nav.journal', Contact: 'nav.contact' };

// L'adresse de chaque entrée, pour que la barre émette de vrais liens.
//
// Toute la navigation était faite de <button onClick>, qui passe par l'API
// d'historique : un robot analyse des <a href>, il ne clique pas et n'exécute
// pas de gestionnaire. La barre — le seul endroit d'où chaque page pointe vers
// toutes les autres — ne transmettait donc rien. Les rubriques n'étaient
// atteignables que depuis le fil d'Ariane d'une fiche, elle-même atteignable
// depuis une rubrique : le graphe se refermait sur lui-même.
//
// Le comportement à l'écran ne change pas : <Lien> navigue toujours côté
// client, sans rechargement.
//
// Séparé de NAV_LABELS à dessein : scripts/verifier-traductions.mjs lit ce
// dernier à l'expression régulière pour contrôler les trois langues, et un
// objet imbriqué le rendrait aveugle.
const NAV_PATHS = { 'About Us': '/about', Workshops: '/workshops', Journal: '/journal', Contact: '/contact' };

const Navbar = ({ cartCount, favCount, onCartClick, onFavClick }) => {
  const { t, tCategory } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Les rubriques affichées suivent le catalogue : celles qui n'ont aucun
  // produit ne s'affichent pas, et réapparaissent seules dès qu'elle en ajoute.
  const [products, setProducts] = useState([]);
  useEffect(() => {
    let actif = true;
    getProducts().then((d) => { if (actif) setProducts(Array.isArray(d) ? d : []); });
    return () => { actif = false; };
  }, []);
  const location = useLocation();
  // Le chemin sans son préfixe de langue : « /en/about » et « /about »
  // désignent la même page, et doivent s'allumer pareil dans le menu.
  const cheminNu = separerLangue(location.pathname).chemin;
  const navigate = useNavigate();
  const lien = useLienLangue();

  const handleSearchSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchOpen(false);
      return;
    }
    navigate(lien(`/search/${encodeURIComponent(q)}`));
    setSearchOpen(false);
    setSearchQuery('');
  };

  const isHomePage = cheminNu === '/';
  const isContentPage = !isHomePage;

  const isLinkActive = (item) => {
    if (item === 'Home') return cheminNu === '/';
    if (item === 'About Us') return cheminNu === '/about';
    if (item === 'Workshops') return cheminNu === '/workshops';
    if (item === 'Journal') return cheminNu.startsWith('/journal');
    if (item === 'Contact') return cheminNu === '/contact';
    if (item === 'Shop') return cheminNu.startsWith('/category/');
    return false;
  };

  const isCategoryActive = (item) => {
    return cheminNu === `/category/${encodeURIComponent(item)}`;
  };

  const getTextColor = () => {
    if (scrolled) return 'text-white';
    return isContentPage ? 'text-slate-stone' : 'text-white text-shadow';
  };

  const getLinkColor = (item) => {
    const active = isLinkActive(item);
    if (scrolled) {
      return active ? 'text-white opacity-100 font-medium' : 'text-white/70 hover:text-white hover:opacity-100';
    }
    if (isContentPage) {
      return active ? 'text-slate-stone opacity-100 font-medium' : 'text-slate-stone/70 hover:text-slate-stone hover:opacity-100';
    }
    return active ? 'text-white opacity-100 font-medium text-shadow' : 'text-white/80 text-shadow hover:text-white hover:opacity-100';
  };

  // Deux seuils, pas un.
  //
  // Avec un seul seuil a 50 px, s'arreter juste dessus faisait basculer la barre
  // a chaque pixel — et comme le changement d'etat modifie sa propre hauteur, il
  // deplace le contenu, ce qui redeclenche l'evenement. La barre passait a
  // l'etat compact a 64 px et n'en revient qu'a 24 px : entre les deux, elle ne
  // change pas d'avis.
  //
  // Le calcul est reporte a la prochaine image : l'evenement de defilement tire
  // beaucoup plus souvent que l'ecran ne se rafraichit.
  useEffect(() => {
    let planifie = false;
    const auDefilement = () => {
      if (planifie) return;
      planifie = true;
      requestAnimationFrame(() => {
        planifie = false;
        const y = window.scrollY;
        setScrolled((avant) => (avant ? y > 24 : y > 64));
      });
    };
    auDefilement();
    window.addEventListener('scroll', auDefilement, { passive: true });
    return () => window.removeEventListener('scroll', auDefilement);
  }, []);

  // Le verrou est partage avec les deux tiroirs : voir le compteur du hook.
  useVerrouDefilement(mobileMenuOpen);

  return (
    <>
      <nav className={`fixed w-full z-50 transition-[background-color,backdrop-filter,padding,box-shadow] duration-[240ms] ease-out ${
        scrolled 
          ? 'glass-dark py-3 lg:py-4' 
          : isContentPage 
            ? 'glass py-3 lg:py-4' 
            : 'bg-transparent py-5 lg:py-8'
      }`}>
        <div className="container mx-auto px-4 sm:px-6 md:px-12 flex items-center">
          <Lien to="/" aria-label={t('nav.home')} className=" hover:opacity-85 press py-1 flex items-center transform-gpu">
            {/* The white logo sits over the hero video, so it disappears on a
                light frame or before the video paints. A soft shadow keeps it
                readable on any background — the client reported it as
                "quasi illisible". */}
            <Logo
              className={`h-5 sm:h-8 w-auto transition-colors duration-200 ${
                scrolled || !isContentPage
                  ? 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]'
                  : 'text-slate-stone'
              }`}
            />
          </Lien>

          {/* Desktop navigation — hidden below lg.
              No "Accueil" link: the client asked for the logo to serve as the
              home button, so a text duplicate would be redundant. */}
          <div className="hidden lg:flex ml-auto space-x-10 items-center mr-10">
            <div className="relative group py-4">
              {/* « Boutique » n'était qu'un déclencheur de survol, sans
                  destination : au clavier et au toucher il ne menait nulle part,
                  et pour un robot il n'existait pas. */}
              <Lien
                to="/category/All"
                className={`font-sans text-[11px] tracking-[0.2em] uppercase py-1 cursor-pointer press relative flex items-center gap-1.5 transform-gpu
                  after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1.5px] after:bg-current after:transition-transform after:duration-300 after:origin-left
                  ${isLinkActive('Shop') ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'} ${getLinkColor('Shop')}`}
              >
                <span>{t('nav.shop')}</span>
                <svg className="w-3 h-3 transition-transform duration-300 group-hover:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </Lien>

              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 mt-0 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <div className="bg-ivory/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-stone/10 p-4 flex flex-col space-y-1">
                  {visibleCategories(products).map((item) => (
                    <Lien
                      key={item}
                      to={cheminRubrique(item)}
                      className={`text-left pl-4 pr-3 py-2 text-xs font-sans tracking-widest uppercase rounded-lg flex items-center justify-between press border-l-2 transform-gpu ${
                        isCategoryActive(item)
                          ? 'text-slate-stone bg-slate-stone/5 border-slate-stone font-medium'
                          : 'text-slate-stone/70 hover:text-slate-stone hover:bg-mist-white border-transparent hover:border-slate-stone/20'
                      }`}
                    >
                      {tCategory(item)}
                    </Lien>
                  ))}
                </div>
              </div>
            </div>

            {['About Us', 'Workshops', 'Journal', 'Contact'].map((item) => (
              <Lien
                key={item}
                to={NAV_PATHS[item]}
                className={`font-sans text-[11px] tracking-[0.2em] uppercase py-1 cursor-pointer press relative transform-gpu
                  after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1.5px] after:bg-current after:transition-transform after:duration-300 after:origin-left
                  ${isLinkActive(item) ? 'after:scale-x-100' : 'after:scale-x-0 hover:after:scale-x-100'} ${getLinkColor(item)}`}
              >
                {t(NAV_LABELS[item])}
              </Lien>
            ))}
          </div>

          {/* Right side icons + hamburger */}
          <div className="flex items-center space-x-1.5 sm:space-x-5 lg:space-x-6 ml-auto lg:ml-0">
            {/* Search — magnifier expands an input. Rendered only when open, at a
                fixed width with a fail-safe fade-in (no width transition from zero,
                which previously failed to expand). */}
            <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center">
              {searchOpen && (
                <input
                  id="search-input"
                  type="text"
                  autoFocus
                  placeholder={t('nav.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onBlur={() => { if (!searchQuery.trim()) setSearchOpen(false); }}
                  className={`w-44 md:w-56 bg-transparent border-b border-current outline-none text-xs font-sans px-2 mr-2 placeholder-current/50 ${getTextColor()}`}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (searchOpen) {
                    handleSearchSubmit();
                  } else {
                    setSearchOpen(true);
                  }
                }}
                className={`relative transition-colors duration-200 p-1.5 sm:p-2 ${getTextColor()}`}
                aria-label={t('nav.search')}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>

            <button id="fav-icon" onClick={onFavClick} aria-label={t('nav.favorites')} className={`relative transition-colors duration-200 p-1.5 sm:p-2 ${getTextColor()}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {favCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-slate-stone text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                  {favCount}
                </span>
              )}
            </button>
            
            <button id="cart-icon" onClick={onCartClick} aria-label={t('nav.cart')} className={`relative transition-colors duration-200 p-1.5 sm:p-2 ${getTextColor()}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-slate-stone text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                  {cartCount}
                </span>
              )}
            </button>

            {/* Hamburger — visible below lg */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`lg:hidden relative transition-colors duration-200 p-1.5 sm:p-2 ${getTextColor()}`}
              aria-label={t('nav.openMenu')}
            >
              <div className="flex flex-col items-end space-y-1.5">
                <div className="w-6 h-[1.5px] bg-current rounded-full" />
                <div className="w-4 h-[1.5px] bg-current rounded-full" />
              </div>
            </button>

            {/* Language switcher — kept as the last item so it always sits at the top-right */}
            <LanguageSwitcher className={getTextColor()} />
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </>
  );
};

export default Navbar;

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import MobileMenu from './MobileMenu';

const Navbar = ({ cartCount, favCount, onCategorySelect, onCartClick, onFavClick }) => {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isHomePage = location.pathname === '/';
  const isContentPage = !isHomePage;

  const getTextColor = () => {
    if (scrolled) return 'text-white';
    return isContentPage ? 'text-slate-stone' : 'text-white text-shadow';
  };

  const getLinkColor = () => {
    if (scrolled) return 'text-white/70 hover:text-white';
    return isContentPage ? 'text-slate-stone/70 hover:text-slate-stone' : 'text-white/80 text-shadow hover:text-white';
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  return (
    <>
      <nav className={`fixed w-full z-50 transition-all duration-700 ease-out ${
        scrolled 
          ? 'glass-dark py-3 lg:py-4' 
          : isContentPage 
            ? 'glass py-3 lg:py-4' 
            : 'bg-transparent py-5 lg:py-8'
      }`}>
        <div className="container mx-auto px-4 sm:px-6 md:px-12 flex items-center">
          <button onClick={() => onCategorySelect('All')} className={`font-serif text-xl lg:text-2xl font-medium tracking-[0.1em] transition-colors duration-500 ${getTextColor()}`}>
            So You Cosmetics
          </button>
          
          {/* Desktop navigation — hidden below lg */}
          <div className="hidden lg:flex ml-auto space-x-10 items-center mr-10">
            <button onClick={() => onCategorySelect('Home')} className={`font-sans text-[11px] tracking-[0.2em] uppercase transition-all duration-500 hover:opacity-100 ${getLinkColor()}`}>
              Home
            </button>
            
            <div className="relative group py-4">
              <button className={`font-sans text-[11px] tracking-[0.2em] uppercase transition-all duration-500 hover:opacity-100 flex items-center gap-1 ${getLinkColor()}`}>
                Shop
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute top-full left-0 mt-0 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-stone/10 p-4 flex flex-col space-y-1">
                  {['Savons', 'Soins de la peau', 'Bien-être et détente', 'Bébés', 'Accessoires', 'Hommes', 'Shampoings', 'Enfants', 'Soin des lèvres', 'Ambiance', 'Savon Liquide', 'Soin des cheveux'].map((item) => (
                    <button 
                      key={item} 
                      onClick={() => onCategorySelect(item)}
                      className="text-left px-4 py-2 text-xs font-sans tracking-widest uppercase text-slate-stone/70 hover:text-slate-stone hover:bg-mist-white rounded-lg transition-colors"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {['About Us', 'Workshops', 'Contact'].map((item) => (
              <button 
                key={item} 
                onClick={() => onCategorySelect(item)}
                className={`font-sans text-[11px] tracking-[0.2em] uppercase transition-all duration-500 hover:opacity-100 ${getLinkColor()}`}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Right side icons + hamburger */}
          <div className="flex items-center space-x-4 sm:space-x-6 ml-auto lg:ml-0">
            {/* Search Icon with sliding input — hidden on very small screens */}
            <div className="hidden sm:flex items-center">
              <input 
                id="search-input"
                type="text" 
                placeholder="Rechercher..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`bg-transparent border-b outline-none text-xs font-sans transition-all duration-500 ease-out placeholder-current/50 ${getTextColor()} ${searchOpen ? 'w-48 opacity-100 px-2 border-current mr-2' : 'w-0 opacity-0 px-0 border-transparent mr-0'}`}
              />
              <button 
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (!searchOpen) {
                    setTimeout(() => document.getElementById('search-input')?.focus(), 50);
                  }
                }} 
                className={`relative transition-colors duration-500 p-2 ${getTextColor()}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>

            <button id="fav-icon" onClick={onFavClick} className={`relative transition-colors duration-500 p-2 ${getTextColor()}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              {favCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-slate-stone text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
                  {favCount}
                </span>
              )}
            </button>
            
            <button id="cart-icon" onClick={onCartClick} className={`relative transition-colors duration-500 p-2 ${getTextColor()}`}>
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
              className={`lg:hidden relative transition-colors duration-500 p-2 ${getTextColor()}`}
              aria-label="Open menu"
            >
              <div className="flex flex-col items-end space-y-1.5">
                <div className="w-6 h-[1.5px] bg-current rounded-full" />
                <div className="w-4 h-[1.5px] bg-current rounded-full" />
              </div>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onCategorySelect={onCategorySelect}
      />
    </>
  );
};

export default Navbar;

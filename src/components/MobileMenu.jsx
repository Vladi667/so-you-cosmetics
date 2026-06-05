import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from './Logo';
import LanguageSwitcher from './LanguageSwitcher';
import { useLanguage } from '../i18n/LanguageContext';

const MobileMenu = ({ isOpen, onClose, onCategorySelect }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, tCategory } = useLanguage();
  const [shopExpanded, setShopExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const handleMobileSearch = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (!q) return;
    onClose();
    navigate(`/search/${encodeURIComponent(q)}`);
    setSearchTerm('');
  };

  const isLinkActive = (item) => {
    if (item === 'Home') return location.pathname === '/';
    if (item === 'About Us') return location.pathname === '/about';
    if (item === 'Workshops') return location.pathname === '/workshops';
    if (item === 'Contact') return location.pathname === '/contact';
    if (item === 'Shop') return location.pathname.startsWith('/category/');
    return false;
  };

  const isCategoryActive = (item) => {
    return location.pathname === `/category/${encodeURIComponent(item)}`;
  };

  // Auto-expand Shop submenu on opening mobile menu if currently on a category page
  useEffect(() => {
    if (isOpen) {
      setShopExpanded(location.pathname.startsWith('/category/'));
    }
  }, [isOpen, location.pathname]);

  const categories = [
    'Savons', 'Soins de la peau', 'Bien-être et détente', 'Bébés',
    'Accessoires', 'Hommes', 'Shampoings', 'Enfants',
    'Soin des lèvres', 'Ambiance', 'Savon Liquide', 'Soin des cheveux'
  ];

  const handleNav = (category) => {
    onClose();
    onCategorySelect(category);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm transition-opacity duration-500 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Menu Panel */}
      <div
        className={`fixed inset-y-0 right-0 z-[90] w-full max-w-sm transform transition-transform duration-500 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full bg-slate-stone/95 backdrop-blur-2xl flex flex-col overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between px-8 pt-8 pb-6">
            <Logo className="h-5 w-auto text-white" />
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all duration-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10 mx-8" />

          {/* Search */}
          <form onSubmit={handleMobileSearch} className="px-8 pt-6">
            <div className="flex items-center gap-3 border-b border-white/20 pb-3">
              <svg className="w-5 h-5 text-white/50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('nav.searchPlaceholderMobile')}
                className="bg-transparent outline-none text-white placeholder-white/40 font-sans text-sm w-full"
              />
            </div>
          </form>

          {/* Navigation Links */}
          <nav className="flex-1 px-8 py-8">
            <ul className="space-y-1">
              {/* Home */}
              <li
                className={`transform transition-all duration-500 ${
                  isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
                style={{ transitionDelay: isOpen ? '100ms' : '0ms' }}
              >
                <button
                  onClick={() => handleNav('Home')}
                  className={`w-full text-left py-4 font-sans text-lg tracking-[0.15em] uppercase transition-all duration-300 flex items-center justify-between active:scale-[0.98] border-l-2 pl-4 -ml-4 transform-gpu ${
                    isLinkActive('Home') 
                      ? 'text-white border-white font-medium' 
                      : 'text-white/60 hover:text-white border-transparent'
                  }`}
                >
                  {t('nav.home')}
                </button>
              </li>

              {/* Shop (expandable) */}
              <li
                className={`transform transition-all duration-500 ${
                  isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
                style={{ transitionDelay: isOpen ? '150ms' : '0ms' }}
              >
                <button
                  onClick={() => setShopExpanded(!shopExpanded)}
                  className={`w-full flex items-center justify-between py-4 font-sans text-lg tracking-[0.15em] uppercase transition-all duration-300 active:scale-[0.98] border-l-2 pl-4 -ml-4 transform-gpu ${
                    isLinkActive('Shop') 
                      ? 'text-white border-white font-medium' 
                      : 'text-white/60 hover:text-white border-transparent'
                  }`}
                >
                  <span>{t('nav.shop')}</span>
                  <svg
                    className={`w-4 h-4 transform transition-transform duration-300 ${shopExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Category Grid */}
                <div
                  className={`overflow-hidden transition-all duration-500 ease-out ${
                    shopExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="grid grid-cols-2 gap-2 pb-4 pt-2">
                    {categories.map((cat, idx) => (
                      <button
                        key={cat}
                        onClick={() => handleNav(cat)}
                        className={`text-left px-4 py-3 font-sans text-xs tracking-[0.15em] uppercase rounded-xl transition-all duration-300 active:scale-[0.97] border transform-gpu ${
                          isCategoryActive(cat)
                            ? 'text-white bg-white/20 border-white/20 font-medium'
                            : 'text-white/60 bg-transparent border-transparent hover:text-white hover:bg-white/10'
                        }`}
                        style={{ transitionDelay: shopExpanded ? `${idx * 30}ms` : '0ms' }}
                      >
                        {tCategory(cat)}
                      </button>
                    ))}
                  </div>
                </div>
              </li>

              {/* About Us */}
              <li
                className={`transform transition-all duration-500 ${
                  isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
                style={{ transitionDelay: isOpen ? '200ms' : '0ms' }}
              >
                <button
                  onClick={() => handleNav('About Us')}
                  className={`w-full text-left py-4 font-sans text-lg tracking-[0.15em] uppercase transition-all duration-300 flex items-center justify-between active:scale-[0.98] border-l-2 pl-4 -ml-4 transform-gpu ${
                    isLinkActive('About Us') 
                      ? 'text-white border-white font-medium' 
                      : 'text-white/60 hover:text-white border-transparent'
                  }`}
                >
                  {t('nav.about')}
                </button>
              </li>

              {/* Workshops */}
              <li
                className={`transform transition-all duration-500 ${
                  isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
                style={{ transitionDelay: isOpen ? '250ms' : '0ms' }}
              >
                <button
                  onClick={() => handleNav('Workshops')}
                  className={`w-full text-left py-4 font-sans text-lg tracking-[0.15em] uppercase transition-all duration-300 flex items-center justify-between active:scale-[0.98] border-l-2 pl-4 -ml-4 transform-gpu ${
                    isLinkActive('Workshops') 
                      ? 'text-white border-white font-medium' 
                      : 'text-white/60 hover:text-white border-transparent'
                  }`}
                >
                  {t('nav.workshops')}
                </button>
              </li>

              {/* Contact */}
              <li
                className={`transform transition-all duration-500 ${
                  isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
                }`}
                style={{ transitionDelay: isOpen ? '300ms' : '0ms' }}
              >
                <button
                  onClick={() => handleNav('Contact')}
                  className={`w-full text-left py-4 font-sans text-lg tracking-[0.15em] uppercase transition-all duration-300 flex items-center justify-between active:scale-[0.98] border-l-2 pl-4 -ml-4 transform-gpu ${
                    isLinkActive('Contact') 
                      ? 'text-white border-white font-medium' 
                      : 'text-white/60 hover:text-white border-transparent'
                  }`}
                >
                  {t('nav.contact')}
                </button>
              </li>
            </ul>
          </nav>

          {/* Footer info */}
          <div className="px-8 py-8 border-t border-white/10">
            <div className="mb-6">
              <LanguageSwitcher inline variant="dark" className="text-white -ml-1.5" />
            </div>
            <p className="text-white/30 font-sans text-xs tracking-wider">
              {t('nav.handmadeInGeneva')}
            </p>
            <p className="text-white/20 font-sans text-xs tracking-wider mt-2">
              3 ave. Pictet-De-Rochemont, 1207 Genève
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMenu;

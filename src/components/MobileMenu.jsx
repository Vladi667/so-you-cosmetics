import React, { useState } from 'react';

const MobileMenu = ({ isOpen, onClose, onCategorySelect }) => {
  const [shopExpanded, setShopExpanded] = useState(false);

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
            <span className="font-serif text-xl text-white tracking-[0.1em]">
              So You
            </span>
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
                  className="w-full text-left py-4 text-white font-sans text-lg tracking-[0.15em] uppercase hover:text-white/70 transition-colors duration-300"
                >
                  Home
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
                  className="w-full flex items-center justify-between py-4 text-white font-sans text-lg tracking-[0.15em] uppercase hover:text-white/70 transition-colors duration-300"
                >
                  <span>Shop</span>
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
                        className="text-left px-4 py-3 text-white/60 font-sans text-xs tracking-[0.15em] uppercase hover:text-white hover:bg-white/10 rounded-xl transition-all duration-300"
                        style={{ transitionDelay: shopExpanded ? `${idx * 30}ms` : '0ms' }}
                      >
                        {cat}
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
                  className="w-full text-left py-4 text-white font-sans text-lg tracking-[0.15em] uppercase hover:text-white/70 transition-colors duration-300"
                >
                  About Us
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
                  className="w-full text-left py-4 text-white font-sans text-lg tracking-[0.15em] uppercase hover:text-white/70 transition-colors duration-300"
                >
                  Workshops
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
                  className="w-full text-left py-4 text-white font-sans text-lg tracking-[0.15em] uppercase hover:text-white/70 transition-colors duration-300"
                >
                  Contact
                </button>
              </li>
            </ul>
          </nav>

          {/* Footer info */}
          <div className="px-8 py-8 border-t border-white/10">
            <p className="text-white/30 font-sans text-xs tracking-wider">
              Handmade in Geneva
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

import React from 'react';

const SideDrawer = ({ isOpen, onClose, title, items, type, onRemove }) => {
  const getImageUrl = (product) => {
    if (product.imageUrl) return product.imageUrl;
    if (product['Variant Image']) return product['Variant Image'];
    return '';
  };

  const getPrice = (product) => {
    return product.price || product['Variant Price'] || '—';
  };

  const getName = (product) => {
    return product.name || product['Product Name'] || product['Name'] || 'Product';
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>

      {/* Drawer */}
      <div className={`fixed top-0 right-0 z-[70] h-full w-full max-w-md bg-white shadow-2xl transform transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-stone/10">
          <h2 className="font-serif text-2xl text-slate-stone">{title}</h2>
          <button 
            onClick={onClose} 
            className="w-10 h-10 rounded-full bg-mist-white flex items-center justify-center hover:bg-slate-stone hover:text-white transition-all duration-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-8 py-6" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-20 h-20 bg-mist-white rounded-full flex items-center justify-center mb-6">
                {type === 'cart' ? (
                  <svg className="w-8 h-8 text-slate-stone/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-slate-stone/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                )}
              </div>
              <p className="font-sans text-stone-gray/60 text-sm">
                {type === 'cart' ? 'Votre panier est vide' : 'Aucun favori pour le moment'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item, index) => (
                <div 
                  key={`${item.id || index}-${index}`} 
                  className="flex gap-5 group bg-mist-white/50 rounded-2xl p-4 hover:bg-mist-white transition-colors duration-300"
                >
                  {getImageUrl(item) && (
                    <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-mist-white">
                      <img 
                        src={getImageUrl(item)} 
                        alt={getName(item)} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-sans text-sm font-medium text-slate-stone truncate">{getName(item)}</h4>
                    <p className="font-sans text-xs text-stone-gray/60 mt-1">CHF {getPrice(item)}</p>
                  </div>
                  <button 
                    onClick={() => onRemove(item, index)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-stone-gray/40 hover:bg-red-50 hover:text-red-500 transition-all duration-300 flex-shrink-0 self-center"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {type === 'cart' && items.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 px-8 py-6 border-t border-slate-stone/10 bg-white">
            <div className="flex justify-between items-center mb-6">
              <span className="font-sans text-sm text-stone-gray">Total estimé</span>
              <span className="font-serif text-2xl text-slate-stone">
                CHF {items.reduce((sum, item) => sum + (parseFloat(item.price || item['Variant Price'] || 0)), 0).toFixed(2)}
              </span>
            </div>
            <button className="w-full py-4 bg-slate-stone text-white font-sans uppercase tracking-[0.3em] text-xs rounded-full hover:bg-slate-stone/90 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
              Commander
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default SideDrawer;

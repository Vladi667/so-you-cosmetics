import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-slate-stone text-mist-white py-20 border-t border-white/5">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-serif text-3xl font-light tracking-wide mb-6">So You Cosmetics</h3>
            <p className="font-sans text-mist-white/70 max-w-sm text-sm leading-relaxed mb-8 font-light">
              Natural, artisanal cosmetics handmade in Geneva. Formulated with Swiss purity for your daily wellness ritual.
            </p>
            <div className="flex gap-4 mb-8">
              <a href="#" className="w-10 h-10 rounded-full border border-mist-white/20 flex items-center justify-center hover:bg-white hover:text-slate-stone hover:border-white transition-all duration-500">
                <span className="sr-only">Instagram</span>
                <span className="text-xs tracking-widest">IG</span>
              </a>
              <a href="#" className="w-10 h-10 rounded-full border border-mist-white/20 flex items-center justify-center hover:bg-white hover:text-slate-stone hover:border-white transition-all duration-500">
                <span className="sr-only">Facebook</span>
                <span className="text-xs tracking-widest">FB</span>
              </a>
            </div>
            <div className="space-y-2 text-sm text-mist-white/60 font-light">
              <p>3 ave. Pictet-De-Rochemont, 1207 Genève</p>
              <p><a href="tel:+41225566992" className="hover:text-white transition-colors duration-300">022 556 69 92</a></p>
            </div>
          </div>

          <div>
            <h4 className="font-sans font-medium uppercase tracking-[0.2em] text-[10px] mb-8 text-alpine-silver">Explore</h4>
            <ul className="space-y-4">
              {['Products', 'Workshops', 'About', 'Contact'].map((item) => (
                <li key={item}>
                  <a href={`#${item.toLowerCase()}`} className="text-sm text-mist-white/60 hover:text-white transition-colors duration-500 font-light tracking-wide">
                    {item}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-sans font-medium uppercase tracking-[0.2em] text-[10px] mb-8 text-alpine-silver">Newsletter</h4>
            <p className="text-sm text-mist-white/60 mb-6 font-light">Join our community for botanical wellness tips and exclusive offers.</p>
            <form className="flex border-b border-mist-white/20 pb-3 group">
              <input 
                type="email" 
                placeholder="Your email address" 
                className="bg-transparent border-none outline-none text-sm w-full placeholder-mist-white/30 text-white font-light"
              />
              <button type="submit" className="text-[10px] uppercase tracking-[0.2em] text-mist-white/50 group-hover:text-white transition-colors duration-500">
                Subscribe
              </button>
            </form>
          </div>

        </div>
        
        <div className="mt-20 pt-8 border-t border-mist-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-mist-white/40 font-light tracking-wide">
            &copy; {new Date().getFullYear()} So You Cosmetics. Handmade in Geneva.
          </p>
          <div className="flex gap-6 text-xs text-mist-white/40 font-light tracking-wide">
            <a href="#" className="hover:text-white transition-colors duration-500">Terms & Conditions</a>
            <a href="#" className="hover:text-white transition-colors duration-500">Privacy Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

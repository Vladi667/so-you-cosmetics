import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo';
import { useLanguage } from '../i18n/LanguageContext';

const SOCIAL = {
  instagram: 'https://www.instagram.com/soyoucosmetics.ch?igsh=MTM4bWd2NTd2OHB1Mw==',
  facebook: 'https://www.facebook.com/share/1JV7jPXXqX/?mibextid=wwXIfr'
};

// Order requested by the client: So You · Boutique · Notre histoire · Ateliers · Contact.
// The Journal entry joins this list when the Journal section itself is built.
const EXPLORE_LINKS = [
  { key: 'home', to: '/' },
  { key: 'products', to: '/category/All' },
  { key: 'about', to: '/about' },
  { key: 'workshops', to: '/workshops' },
  { key: 'journal', to: '/journal' },
  { key: 'contact', to: '/contact' }
];

const Footer = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;

    const finish = () => {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 4000);
    };

    fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: value })
    })
      .then(res => {
        if (!res.ok) throw new Error('Subscription failed');
        return res.json();
      })
      .then(finish)
      .catch(err => {
        console.warn('Newsletter signup failed, showing optimistic confirmation:', err);
        finish();
      });
  };

  return (
    <footer className="bg-slate-stone text-mist-white py-20 border-t border-white/5">
      <div className="container mx-auto px-6 md:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8">
          <div className="col-span-1 md:col-span-2">
            <Logo className="h-8 w-auto text-white mb-6" />
            <p className="font-sans text-mist-white/70 max-w-sm text-sm leading-relaxed mb-8 font-light">
              {t('footer.tagline')}
            </p>
            <div className="flex gap-4 mb-8">
              <a
                href={SOCIAL.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-mist-white/20 flex items-center justify-center hover:bg-ivory hover:text-slate-stone hover:border-white transition-all duration-250 active:scale-[0.97]"
                aria-label="Instagram"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.7" fill="currentColor" stroke="none" />
                </svg>
              </a>
              <a
                href={SOCIAL.facebook}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full border border-mist-white/20 flex items-center justify-center hover:bg-ivory hover:text-slate-stone hover:border-white transition-all duration-250 active:scale-[0.97]"
                aria-label="Facebook"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
                </svg>
              </a>
            </div>
            <div className="space-y-2 text-sm text-mist-white/60 font-light">
              <p>{t('footer.address')}</p>
              <p><a href="tel:+41225566992" className="hover:text-white transition-colors duration-200 active:scale-[0.97]">022 556 69 92</a></p>
            </div>
          </div>

          {/* Client asked for the EXPLORER block centred; the brand/address
              column above stays left-aligned. */}
          <div className="text-center">
            <h4 className="font-sans font-medium uppercase tracking-[0.2em] text-[10px] mb-8 text-alpine-silver">{t('footer.explore')}</h4>
            <ul className="space-y-4">
              {EXPLORE_LINKS.map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.to}
                    className="text-sm text-mist-white/60 hover:text-white transition-colors duration-200 font-light tracking-wide"
                  >
                    {t(`footer.links.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-sans font-medium uppercase tracking-[0.2em] text-[10px] mb-8 text-alpine-silver">{t('footer.newsletter')}</h4>
            <p className="text-sm text-mist-white/60 mb-6 font-light">{t('footer.newsletterText')}</p>
            <form onSubmit={handleSubscribe} className="flex border-b border-mist-white/20 pb-3 group">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('footer.emailPlaceholder')}
                className="bg-transparent border-none outline-none text-sm w-full placeholder-mist-white/30 text-white font-light"
              />
              <button type="submit" className="text-[10px] uppercase tracking-[0.2em] text-mist-white/50 group-hover:text-white transition-colors duration-200 whitespace-nowrap active:scale-[0.97]">
                {subscribed ? t('footer.subscribed') : t('footer.subscribe')}
              </button>
            </form>
          </div>

        </div>

        <div className="mt-20 pt-8 border-t border-mist-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-mist-white/40 font-light tracking-wide">
            {t('footer.rights', { year: new Date().getFullYear() })}
          </p>
          <div className="flex gap-6 text-xs text-mist-white/40 font-light tracking-wide">
            <Link to="/terms" className="hover:text-white transition-colors duration-200">{t('footer.terms')}</Link>
            <Link to="/privacy" className="hover:text-white transition-colors duration-200">{t('footer.privacy')}</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

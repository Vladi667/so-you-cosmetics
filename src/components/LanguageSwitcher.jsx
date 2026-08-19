import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// Two presentations:
//  • default: a compact dropdown showing just the active code (e.g. "FR") + chevron.
//    Small enough for the top-right of the navbar, especially on mobile.
//  • inline: the full "FR / EN / DE" segmented control, used where space is ample
//    (the mobile slide-out menu footer).
//
// Colours inherit from the surrounding text via `currentColor`; pass a text-colour
// class through `className`. `variant="dark"` is used on dark backgrounds.
const LanguageSwitcher = ({ className = '', variant = 'inherit', inline = false }) => {
  const { language, setLanguage, languages, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isDark = variant === 'dark';

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // --- Inline segmented control (FR / EN / DE) ---
  if (inline) {
    return (
      <div
        className={`inline-flex items-center gap-0.5 ${className}`}
        role="group"
        aria-label={t('nav.language')}
      >
        {languages.map((lng, i) => {
          const active = lng.code === language;
          return (
            <React.Fragment key={lng.code}>
              {i > 0 && <span className="opacity-30 text-[10px] select-none">/</span>}
              <button
                type="button"
                onClick={() => setLanguage(lng.code)}
                aria-pressed={active}
                title={lng.name}
                className={`font-sans text-[11px] tracking-[0.15em] uppercase px-1.5 py-1 rounded transition-all duration-300 active:scale-95 ${
                  active ? `font-semibold opacity-100 ${isDark ? 'text-white' : ''}` : 'opacity-50 hover:opacity-90'
                }`}
              >
                {lng.label}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // --- Compact dropdown ---
  const current = languages.find((l) => l.code === language) || languages[0];

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('nav.language')}
        className="flex items-center gap-0.5 font-sans text-[11px] tracking-[0.15em] uppercase px-1 py-1 transition-opacity duration-300 opacity-80 hover:opacity-100 active:scale-95"
      >
        {current.label}
        <svg
          className={`w-3 h-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-2 z-[60] min-w-[7rem] bg-ivory/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-stone/10 p-1.5 flex flex-col"
        >
          {languages.map((lng) => {
            const active = lng.code === language;
            return (
              <button
                key={lng.code}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => { setLanguage(lng.code); setOpen(false); }}
                className={`text-left px-3 py-2 rounded-lg text-xs font-sans tracking-widest uppercase transition-all duration-200 flex items-center justify-between gap-3 ${
                  active
                    ? 'text-slate-stone bg-slate-stone/5 font-semibold'
                    : 'text-slate-stone/70 hover:text-slate-stone hover:bg-mist-white'
                }`}
              >
                <span>{lng.label}</span>
                <span className="text-[10px] tracking-normal normal-case opacity-50">{lng.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;

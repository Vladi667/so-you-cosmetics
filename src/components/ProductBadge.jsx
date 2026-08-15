import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';

// The two badges the client asked for are stored as canonical keys so they can
// be translated; anything else in `ribbon` is legacy free text (e.g. "Hydrolat")
// and is displayed as typed.
const BADGE_PRESETS = ['coming-soon', 'best-seller'];

const PRESET_STYLES = {
  'coming-soon': 'bg-slate-stone/90 text-white',
  'best-seller': 'bg-amber-100/95 text-amber-900',
};

const ProductBadge = ({ ribbon, size = 'md' }) => {
  const { t } = useLanguage();
  if (!ribbon) return null;

  const isPreset = BADGE_PRESETS.includes(ribbon);
  const label = isPreset ? t(`catalog.badges.${ribbon}`) : ribbon;
  const tone = PRESET_STYLES[ribbon] || 'bg-ivory/90 text-slate-stone';
  const dims = size === 'lg'
    ? 'text-xs px-4 py-2'
    : 'text-[9px] sm:text-xs px-2 py-1 sm:px-3 sm:py-1.5';

  return (
    <span className={`inline-block backdrop-blur-sm tracking-widest uppercase rounded-full shadow-sm font-medium ${tone} ${dims}`}>
      {label}
    </span>
  );
};

export default ProductBadge;

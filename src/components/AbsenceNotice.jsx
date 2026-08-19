import React from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { getAbsenceNotice } from '../services/shop';

// The notice she puts up when she is away, typically about dispatch delays.
//
// It sits above the navigation rather than inside a page, because the question
// it answers — "when will my order actually ship?" — is asked from wherever the
// visitor happens to be, and most often from the basket. Putting it only on the
// contact page or at checkout, as she worried, would reach the people who
// already went looking.
//
// Renders nothing at all when she has not switched it on, so the layout is
// untouched the rest of the year.
const AbsenceNotice = () => {
  const { language } = useLanguage();
  const message = getAbsenceNotice(language);
  if (!message) return null;

  return (
    <div role="status" className="relative z-50 bg-slate-stone text-ivory">
      <p className="container mx-auto px-6 py-2.5 text-center font-sans text-xs sm:text-sm font-light tracking-wide">
        {message}
      </p>
    </div>
  );
};

export default AbsenceNotice;

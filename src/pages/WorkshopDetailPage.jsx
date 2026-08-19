import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';

// One page per workshop. She asked for "un lien direct vers la page détaillée de
// chaque atelier depuis le menu déroulant" — until now a workshop was a card in
// a list with nowhere to point at, so it could be neither linked nor shared.
//
// The list is fetched rather than a single record: the API exposes the whole
// collection and no per-workshop route, and with a handful of workshops that is
// cheaper than adding an endpoint whose only job is to filter one out.
const WorkshopDetailPage = () => {
  const { id } = useParams();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [workshop, setWorkshop] = useState(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;
    fetch('/api/workshops')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((list) => {
        if (!active) return;
        const found = (Array.isArray(list) ? list : []).find((w) => String(w.id) === String(id));
        setWorkshop(found || null);
        setState(found ? 'ready' : 'missing');
      })
      .catch(() => { if (active) setState('missing'); });
    return () => { active = false; };
  }, [id]);

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-mist-white flex items-center justify-center">
        <p className="font-sans text-sm text-stone-gray">…</p>
      </div>
    );
  }

  // A workshop she has deleted, or a stale link. Say so and offer the way back
  // rather than leaving a blank page that looks like a broken site.
  if (state === 'missing') {
    return (
      <div className="min-h-screen bg-mist-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-serif text-3xl text-slate-stone mb-4">{t('workshopsPage.notFoundTitle')}</h1>
          <p className="font-sans text-sm text-stone-gray mb-8">{t('workshopsPage.notFoundText')}</p>
          <Link
            to="/workshops"
            className="inline-block px-8 py-3 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone/90 transition-colors"
          >
            {t('workshopsPage.backToList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mist-white pt-28 sm:pt-36 pb-20">
      <div className="container mx-auto px-6 md:px-12 max-w-4xl">
        <Link
          to="/workshops"
          className="inline-block font-sans text-xs uppercase tracking-widest text-stone-gray hover:text-slate-stone transition-colors mb-8"
        >
          ← {t('workshopsPage.backToList')}
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-14 items-start">
          <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-ivory border border-slate-stone/[0.07] shadow-sm">
            <img
              src={workshop.image_url || '/workshop_ingredients.png'}
              alt={workshop.title || ''}
              className="absolute inset-0 w-full h-full object-cover brightness-[1.02] saturate-[0.93]"
            />
            <div className="absolute inset-0 bg-[#B9A891]/[0.12] mix-blend-soft-light pointer-events-none" />
          </div>

          <div>
            <p className="font-sans text-[10px] tracking-[0.42em] uppercase text-stone-gray/70 mb-4">
              {t('workshopsPage.eyebrow')}
            </p>
            <h1 className="font-serif font-light text-slate-stone text-3xl sm:text-4xl leading-[1.12] mb-6">
              {workshop.title}
            </h1>

            <div className="flex flex-wrap gap-x-8 gap-y-3 mb-8">
              {workshop.price !== undefined && workshop.price !== '' && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-stone-gray/70 mb-1">{t('workshopsPage.priceLabel')}</p>
                  <p className="font-sans text-slate-stone">CHF {workshop.price}</p>
                </div>
              )}
              {workshop.duration && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-stone-gray/70 mb-1">{t('workshopsPage.durationLabel')}</p>
                  <p className="font-sans text-slate-stone">{workshop.duration}</p>
                </div>
              )}
            </div>

            {workshop.description && (
              <p className="font-sans font-light text-stone-gray leading-relaxed whitespace-pre-line mb-10">
                {workshop.description}
              </p>
            )}

            <button
              type="button"
              onClick={() => navigate('/contact', {
                state: { subject: t('workshopsPage.reservationSubject', { title: workshop.title }) },
              })}
              className="px-8 py-3.5 bg-slate-stone text-white rounded-full font-sans uppercase tracking-[0.2em] text-[10px] sm:text-xs hover:bg-slate-stone/90 transition-colors active:scale-[0.97]"
            >
              {t('workshopsPage.reserveThis')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkshopDetailPage;

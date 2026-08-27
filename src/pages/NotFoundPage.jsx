import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';

// Ce que voit quelqu'un dont l'adresse ne mène nulle part.
//
// Il n'y avait aucune route « * » : une adresse inconnue affichait la barre de
// navigation, le pied de page, et rien entre les deux — une page blanche sans
// explication ni issue. Le serveur répond désormais un vrai 404 (voir
// server/index.js) ; ceci en est le visage, et les deux liens sont là pour que
// la visite continue plutôt qu'elle ne s'arrête.
const NotFoundPage = () => {
  const { t } = useLanguage();
  useMetadonnees({ titre: t('notFound.title'), description: t('notFound.text') });

  return (
    <div className="min-h-screen bg-mist-white flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h1 className="font-serif text-2xl sm:text-3xl text-slate-stone mb-4">
          {t('notFound.title')}
        </h1>
        <p className="font-sans font-light text-stone-gray leading-relaxed">
          {t('notFound.text')}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/category/All"
            className="inline-block px-8 py-3 bg-slate-stone text-white rounded-full text-xs uppercase tracking-widest hover:bg-slate-stone/90 transition-colors press"
          >
            {t('notFound.shop')}
          </Link>
          <Link
            to="/"
            className="inline-block px-8 py-3 border border-slate-stone/20 text-slate-stone rounded-full text-xs uppercase tracking-widest hover:border-slate-stone/40 transition-colors press"
          >
            {t('notFound.home')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;

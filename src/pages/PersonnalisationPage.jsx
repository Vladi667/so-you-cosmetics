import React, { useEffect, useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { getProducts, imageUrl } from '../services/products';
import useEnvoiFormulaire from '../hooks/useEnvoiFormulaire';
import VisionneuseImage from '../components/VisionneuseImage';

// La fiche « Commande personnalisée » du catalogue. Ses treize photos de
// réalisations y vivent déjà ; la page les lit de là plutôt que de les recopier,
// pour qu'un changement dans l'administration se voie ici sans toucher au code.
const ID_FICHE_SOURCE = 'product_d13bfad4-56a7-e63e-672a-0aa651bd6bf5';

// Le sur-mesure et les cadeaux d'entreprise.
//
// Tout cela existait — 1 427 caractères — enfoui dans la description d'un
// produit à CHF 0 rangé dans « Accessoires », en neuf paragraphes sans un seul
// titre. Une commande d'entreprise se décide sur des conditions précises : un
// minimum de quinze savons, un préavis de trois mois. Noyées dans un bloc de
// texte, ces conditions ne se lisent pas ; affichées comme des engagements,
// elles répondent d'avance à la question qu'on allait poser.
const PersonnalisationPage = () => {
  const { t } = useLanguage();
  const [photos, setPhotos] = useState([]);
  const [visionneuse, setVisionneuse] = useState(null); // index ouvert, ou null
  const [formulaire, setFormulaire] = useState({
    name: '', email: '', occasion: '', quantite: '', date: '', details: '',
  });
  const { enCours, message, messageVisible, envoyer } = useEnvoiFormulaire();

  useEffect(() => {
    let actif = true;
    getProducts()
      .then((liste) => {
        if (!actif) return;
        const fiche = (liste || []).find((p) => p.id === ID_FICHE_SOURCE);
        setPhotos(fiche && Array.isArray(fiche.images) ? fiche.images : []);
      })
      .catch(() => {});
    return () => { actif = false; };
  }, []);

  const majChamp = (cle) => (e) => setFormulaire({ ...formulaire, [cle]: e.target.value });

  const envoyerDemande = (e) => {
    e.preventDefault();
    if (enCours) return;
    // La demande part par le même chemin que le formulaire de contact : elle
    // arrive dans sa boîte, au même endroit que le reste, plutôt que dans une
    // seconde file qu'elle devrait penser à relever.
    const message = [
      `${t('personnalisation.fieldOccasion')} : ${formulaire.occasion || '—'}`,
      `${t('personnalisation.fieldQuantity')} : ${formulaire.quantite || '—'}`,
      `${t('personnalisation.fieldDate')} : ${formulaire.date || '—'}`,
      '',
      formulaire.details,
    ].join('\n');

    envoyer(
      fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formulaire.name,
          email: formulaire.email,
          subject: `Demande sur mesure — ${formulaire.occasion || 'projet'}`,
          message,
        }),
      }),
      { surSucces: () => setFormulaire({ name: '', email: '', occasion: '', quantite: '', date: '', details: '' }) }
    );
  };

  const champ = 'w-full bg-mist-white border border-slate-stone/10 rounded-2xl px-5 py-3 font-sans text-slate-stone text-sm focus:outline-none focus:border-slate-stone/40';

  const formes = [
    { titre: 'form1Title', corps: 'form1Body', condition: 'form1Condition' },
    { titre: 'form2Title', corps: 'form2Body', condition: 'form2Condition' },
    { titre: 'form3Title', corps: 'form3Body', condition: 'form3Condition' },
  ];

  return (
    <div className="min-h-screen bg-mist-white pt-28 sm:pt-36 pb-24">
      <div className="container mx-auto px-6 md:px-12">

        <header className="max-w-[65ch] mb-14">
          <p className="caps-label font-sans text-[10px] text-stone-gray/70 mb-4">
            {t('personnalisation.eyebrow')}
          </p>
          <h1 className="font-serif font-light text-slate-stone text-3xl sm:text-4xl md:text-5xl mb-6">
            {t('personnalisation.title')}
          </h1>
          <p className="font-sans font-light text-stone-gray leading-relaxed">
            {t('personnalisation.lead')}
          </p>
        </header>

        {/* Les trois formes, chacune avec sa condition affichée comme un
            engagement plutôt que comme une note de bas de page. */}
        <section className="mb-16">
          <h2 className="font-serif text-2xl sm:text-3xl text-slate-stone mb-8">
            {t('personnalisation.formsTitle')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {formes.map((f) => (
              <article key={f.titre} className="rounded-3xl border border-slate-stone/[0.08] bg-ivory p-6 sm:p-8">
                <h3 className="font-serif text-xl text-slate-stone mb-3">{t(`personnalisation.${f.titre}`)}</h3>
                <p className="font-sans text-sm font-light text-stone-gray leading-relaxed mb-5">
                  {t(`personnalisation.${f.corps}`)}
                </p>
                <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-slate-stone border-t border-slate-stone/10 pt-4">
                  {t(`personnalisation.${f.condition}`)}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Le remplissage des contenants apportés. C'est une quatrième offre,
            distincte des trois formes : on n'y personnalise rien, on réutilise. */}
        <section className="mb-16 rounded-3xl bg-ivory border border-slate-stone/[0.08] p-6 sm:p-10">
          <h2 className="font-serif text-2xl text-slate-stone mb-3">{t('personnalisation.refillTitle')}</h2>
          <p className="font-sans text-sm font-light text-stone-gray leading-relaxed max-w-[65ch] mb-4">
            {t('personnalisation.refillBody')}
          </p>
          <p className="font-sans text-xs text-stone-gray/80 leading-relaxed max-w-[65ch]">
            {t('personnalisation.refillCondition')}
          </p>
        </section>

        <section className="mb-16">
          <h2 className="font-serif text-2xl text-slate-stone mb-2">{t('personnalisation.occasionsTitle')}</h2>
          <div className="flex flex-wrap gap-2">
            {(t('personnalisation.occasions') || []).map((o, i) => (
              <span key={i} className="rounded-full border border-slate-stone/15 bg-ivory px-4 py-1.5 font-sans text-xs text-slate-stone">
                {o}
              </span>
            ))}
          </div>
        </section>

        {/* Les réalisations. Servies en 1600 px : ce sont des photos qu'on
            regarde pour juger d'un rendu, pas des vignettes de catalogue. */}
        {photos.length > 0 && (
          <section className="mb-16">
            <h2 className="font-serif text-2xl sm:text-3xl text-slate-stone mb-2">
              {t('personnalisation.galleryTitle')}
            </h2>
            <p className="font-sans text-sm text-stone-gray mb-8">{t('personnalisation.galleryLead')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
              {photos.map((photo, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setVisionneuse(i)}
                  aria-label={t('product.imageOf', { n: i + 1, total: photos.length })}
                  className="press aspect-[4/5] overflow-hidden rounded-2xl bg-lake-mist cursor-zoom-in"
                >
                  <img
                    src={imageUrl(photo, 800)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* La demande. Même motif d'envoi que les autres formulaires du site :
            le succès ne s'affiche que sur une réponse reçue. */}
        <section className="max-w-2xl">
          <h2 className="font-serif text-2xl sm:text-3xl text-slate-stone mb-2">
            {t('personnalisation.formTitle')}
          </h2>
          <p className="font-sans text-sm text-stone-gray mb-8">{t('personnalisation.formLead')}</p>

          <form onSubmit={envoyerDemande} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input type="text" required value={formulaire.name} onChange={majChamp('name')}
                placeholder={t('drawer.yourName')} className={champ} />
              <input type="email" required value={formulaire.email} onChange={majChamp('email')}
                placeholder="votre@email.com" className={champ} />
              <input type="text" value={formulaire.occasion} onChange={majChamp('occasion')}
                placeholder={t('personnalisation.fieldOccasion')} className={champ} />
              <input type="text" value={formulaire.quantite} onChange={majChamp('quantite')}
                placeholder={t('personnalisation.fieldQuantity')} className={champ} />
              <div className="sm:col-span-2">
                <label className="block font-sans text-[10px] uppercase tracking-[0.16em] text-stone-gray/70 mb-1">
                  {t('personnalisation.fieldDate')}
                </label>
                <input type="date" value={formulaire.date} onChange={majChamp('date')} className={champ} />
              </div>
            </div>

            <textarea rows={5} required value={formulaire.details} onChange={majChamp('details')}
              placeholder={t('personnalisation.detailsPlaceholder')} className={champ} />

            <button type="submit" disabled={enCours}
              className="press rounded-full bg-slate-stone px-8 py-4 font-sans text-xs uppercase tracking-[0.2em] text-white disabled:opacity-60">
              {enCours ? t('personnalisation.sending') : t('personnalisation.submit')}
            </button>

            {message && (
              <p
                role={message === 'erreur' ? 'alert' : 'status'}
                aria-hidden={!messageVisible}
                className={`text-sm font-light transition-opacity duration-500 ${messageVisible ? 'opacity-100' : 'opacity-0'} ${message === 'erreur' ? 'text-red-600' : 'text-green-700'}`}
              >
                {message === 'erreur' ? t('personnalisation.error') : t('personnalisation.sent')}
              </p>
            )}
          </form>
        </section>
      </div>

      {/* La visionneuse de la fiche produit, telle quelle. Le plan prévoyait
          d'écrire ici une version simple puis de la remplacer au module 6 —
          celui-ci étant déjà livré, l'heure d'harmonisation est économisée. */}
      {visionneuse !== null && (
        <VisionneuseImage
          images={photos}
          indexInitial={visionneuse}
          alt={t('personnalisation.galleryTitle')}
          onClose={() => setVisionneuse(null)}
        />
      )}
    </div>
  );
};

export default PersonnalisationPage;

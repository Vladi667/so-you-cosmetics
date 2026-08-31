import Lien from '../components/Lien';
import Catalog from '../components/Catalog';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';
import { FAMILLES, trouverFamille, contenuFamille } from '../data/familles';

// Une page de famille commerciale.
//
// Un seul composant pour les six : elles ont la même forme, et six fichiers
// qui ne diffèrent que par leur texte finiraient par diverger sur la mise en
// page sans que personne ne le décide.
//
// La grille de produits est celle du reste du site — filtres, pagination,
// panier, favoris compris. La réécrire ici aurait dupliqué tout ce qui touche
// à l'ajout au panier, c'est-à-dire la seule partie du site où un défaut coûte
// de l'argent.
const FamillePage = ({ slug, addToCart, toggleFavorite, favorites }) => {
  const { t, language } = useLanguage();
  const famille = trouverFamille(slug);
  const contenu = contenuFamille(famille, language);

  // Le serveur ne route que les six slugs connus, donc ce cas ne devrait pas
  // survenir. Il est traité quand même : un composant qui suppose ses données
  // présentes finit toujours par tomber sur celui qui ne l'est pas.
  useMetadonnees(
    contenu
      ? { titre: contenu.titre, description: contenu.intro.slice(0, 160) }
      : { titre: t('nav.shop') }
  );

  if (!famille || !contenu) return null;

  // Les cinq autres familles, pour le maillage interne. Une page qu'aucune
  // autre ne cite est une page que le robot atteint une fois et n'a aucune
  // raison de revoir.
  const voisines = FAMILLES.filter((f) => f.slug !== famille.slug);

  return (
    <div className="pt-24 min-h-screen bg-mist-white flex flex-col">
      <div className="flex-grow">
        <article className="container mx-auto px-6 pt-12 pb-4">
          <nav className="flex items-center gap-4 text-xs tracking-widest uppercase text-stone-gray mb-8">
            <Lien to="/" className="hover:text-slate-stone transition-colors">{t('category.home')}</Lien>
            <span>/</span>
            <span className="text-slate-stone font-medium">{contenu.titre}</span>
          </nav>

          <header className="max-w-3xl">
            <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl text-slate-stone mb-4">
              {contenu.titre}
            </h1>
            <p className="font-sans text-lg font-light text-slate-stone/80 mb-6">
              {contenu.chapeau}
            </p>
            <p className="font-sans font-light text-stone-gray leading-relaxed">
              {contenu.intro}
            </p>
          </header>

          <div className="mt-12 grid gap-10 md:grid-cols-3 max-w-5xl">
            {contenu.sections.map((s) => (
              <section key={s.titre}>
                <h2 className="font-serif text-xl text-slate-stone mb-3">{s.titre}</h2>
                <p className="font-sans font-light text-stone-gray leading-relaxed text-sm">
                  {s.corps}
                </p>
              </section>
            ))}
          </div>

          {/* La question qu'on nous pose en boutique, avec sa réponse.
              Elle sert deux publics : la personne qui hésite, et le moteur qui
              affiche parfois ce genre de paire directement dans ses résultats. */}
          <section className="mt-12 max-w-3xl border-l-2 border-alpine-silver pl-6">
            <h2 className="font-serif text-xl text-slate-stone mb-3">{contenu.question}</h2>
            <p className="font-sans font-light text-stone-gray leading-relaxed text-sm">
              {contenu.reponse}
            </p>
          </section>
        </article>

        <Catalog
          rubriques={famille.rubriques}
          sansEntete
          addToCart={addToCart}
          toggleFavorite={toggleFavorite}
          favorites={favorites}
        />

        <nav className="container mx-auto px-6 pb-16 pt-4">
          <h2 className="font-sans text-xs tracking-widest uppercase text-stone-gray mb-4">
            {t('category.voirAussi')}
          </h2>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {voisines.map((f) => (
              <li key={f.slug}>
                <Lien
                  to={`/${f.slug}`}
                  className="font-sans text-sm font-light text-stone-gray hover:text-slate-stone underline underline-offset-4 transition-colors"
                >
                  {contenuFamille(f, language).titre}
                </Lien>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default FamillePage;

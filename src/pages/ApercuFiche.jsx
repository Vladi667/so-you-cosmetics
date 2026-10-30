import React, { useState } from 'react';
import CarteProduit from '../components/CarteProduit';

// Ce que verra la cliente, pendant qu'elle saisit.
//
// Vingt-cinq champs se remplissaient à l'aveugle : on enregistrait, on ouvrait
// la boutique dans un autre onglet, on regardait, on revenait. C'est ce
// va-et-vient qui faisait du formulaire une corvée administrative — pas sa
// longueur.
//
// La carte vient de CarteProduit, celle-là même que rend la grille : un aperçu
// qui recopierait ses classes mentirait dès la première retouche du catalogue.

// L'admin ne parle que français. Les quelques clés dont la carte a besoin.
const MOTS = {
  'catalog.outOfStock': 'Épuisé',
  'catalog.cosmeticsFallback': 'Cosmétiques',
  'catalog.onQuote': 'Sur devis',
};
const traduire = (cle, params) => {
  if (cle === 'catalog.fromPrice') return `dès CHF ${params.price}`;
  if (cle === 'catalog.scentCount') return `${params.n} senteurs`;
  return MOTS[cle] || cle;
};

// La même règle que le serveur, sinon l'aperçu promettrait autre chose que ce
// qui s'affichera. Voir normalizeProductInput dans server/db.js.
export function resumerContenances(libelles) {
  const unites = libelles.map((l) => (String(l).match(/[a-zA-Z]+\.?$/) || [''])[0].toLowerCase());
  const memeUnite = unites[0] && unites.every((u) => u === unites[0]);
  return memeUnite
    ? libelles.map((l) => String(l).replace(/\s*[a-zA-Z]+\.?$/, '').trim()).join(' · ') + ' ' + unites[0]
    : libelles.join(' · ');
}

// Un cadre de l'aperçu. Défini ici et non dans le composant : à l'intérieur,
// React le tiendrait pour un type neuf à chaque frappe et remonterait tout son
// contenu — la photo de la carte comprise, qui clignoterait à chaque lettre.
function Cadre({ titre, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-stone/10 p-4 shadow-sm">
      <h4 className="font-sans text-[10px] uppercase tracking-[0.22em] text-stone-gray/70 mb-3">{titre}</h4>
      {children}
    </div>
  );
}

function ApercuFiche({ productForm }) {
  // Le format regardé dans l'aperçu. Il ne voyage nulle part : c'est un coup
  // d'œil, pas une saisie.
  const [formatRegarde, setFormatRegarde] = useState(0);

  const remplis = (productForm.variantes || [])
    .filter((v) => String(v.libelle).trim() && Number(v.prix) > 0);
  const decline = remplis.length > 1;

  const rubriques = String(productForm.collectionsText || '')
    .split(',').map((c) => c.trim()).filter(Boolean);

  const prixBase = decline
    ? Math.min(...remplis.map((v) => Number(v.prix)))
    : Number(productForm.price || 0);

  const contenance = decline
    ? resumerContenances(remplis.map((v) => String(v.libelle).trim()))
    : productForm.contenance;

  // Le produit tel que le catalogue le servira. On le fabrique ici plutôt que
  // d'attendre l'enregistrement : c'est tout l'objet de l'aperçu.
  const produit = {
    id: productForm.id || 'apercu',
    name: productForm.name || 'Sans nom',
    price: prixBase,
    images: productForm.images || [],
    ribbon: productForm.ribbon,
    collections: rubriques,
    contenance,
    variantes: remplis.map((v) => ({ ...v, prix: Number(v.prix) })),
    inStock: productForm.inStock !== false,
  };

  const i = Math.min(formatRegarde, Math.max(0, remplis.length - 1));
  const prixAffiche = decline ? Number(remplis[i].prix) : prixBase;

  // Ce qu'un champ vide coûte, dit en clair. Ni note, ni score : une phrase
  // qui explique pourquoi ça compte, et rien quand c'est rempli.
  const diagnostics = [
    {
      ok: String(productForm.inci || '').trim().length > 0,
      vide: 'Pas de liste INCI — c’est ce que cherchent les peaux sensibles.',
      plein: 'Liste INCI renseignée.',
    },
    {
      ok: String(productForm.ingredients || '').trim().length > 0,
      vide: 'Pas d’ingrédients en français — Google lit cette langue-là.',
      plein: 'Ingrédients en français.',
    },
    {
      ok: String(productForm.typePeauText || '').trim() && String(productForm.besoinsText || '').trim(),
      vide: 'Types de peau ou besoins manquants : la fiche sort des filtres.',
      plein: 'Filtres peau et besoins renseignés.',
    },
    {
      ok: (productForm.images || []).length >= 2,
      vide: 'Une seule photo — la fiche paraît vide au défilement.',
      plein: `${(productForm.images || []).length} photos.`,
    },
    {
      ok: String(productForm.description || '').replace(/<[^>]*>/g, '').trim().length > 120,
      vide: 'Description courte : moins de matière pour la recherche.',
      plein: 'Description substantielle.',
    },
  ];

  return (
    <aside className="xl:sticky xl:top-6 flex flex-col gap-4">
      <p className="font-sans text-[10px] uppercase tracking-[0.26em] text-stone-gray/70 ml-1">
        Ce que verra la cliente
      </p>

      <Cadre titre="Sur la grille">
        {/* Sans `lien` : dans un aperçu, un clic n'aurait nulle part où aller. */}
        <CarteProduit produit={produit} t={traduire} />
      </Cadre>

      <Cadre titre="Sur la fiche">
        <p className="font-serif text-lg leading-tight text-slate-stone">
          {productForm.name || 'Sans nom'}
        </p>
        <div className="flex items-baseline gap-2 mt-2 mb-3">
          <span className="font-sans text-xl font-light text-slate-stone tabular-nums">
            {prixAffiche > 0 ? `CHF ${prixAffiche.toFixed(2)}` : 'Sur devis'}
          </span>
          {(decline ? remplis[i].libelle : productForm.contenance) && (
            <span className="font-sans text-xs text-stone-gray/70">
              · {decline ? remplis[i].libelle : productForm.contenance}
            </span>
          )}
        </div>
        {decline && (
          <div>
            <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-stone-gray/70 mb-2">Contenance</p>
            <div className="flex flex-wrap gap-1.5">
              {remplis.map((v, k) => (
                <button
                  key={v.libelle + k}
                  type="button"
                  onClick={() => setFormatRegarde(k)}
                  aria-pressed={k === i}
                  className={`press rounded-full border px-3 py-1.5 font-sans text-xs tabular-nums transition-colors ${
                    k === i
                      ? 'border-slate-stone bg-slate-stone text-white'
                      : 'border-slate-stone/20 bg-mist-white text-slate-stone hover:border-slate-stone/40'
                  }`}
                >
                  {v.libelle}
                  <span className={`ml-1.5 ${k === i ? 'text-white/60' : 'text-stone-gray/60'}`}>
                    CHF {Number(v.prix).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Cadre>

      <Cadre titre="Santé de la fiche">
        <div className="flex flex-col gap-2">
          {diagnostics.map((d, k) => (
            <div key={k} className="grid grid-cols-[8px_1fr] gap-2.5 items-start">
              <span className={`w-2 h-2 rounded-full mt-1.5 ${d.ok ? 'bg-sage' : 'bg-amber-600'}`} />
              <span className={`font-sans text-xs leading-snug ${d.ok ? 'text-stone-gray' : 'text-slate-stone'}`}>
                {d.ok ? d.plein : d.vide}
              </span>
            </div>
          ))}
        </div>
      </Cadre>
    </aside>
  );
}

export default ApercuFiche;

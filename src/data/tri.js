// Le tri et les fourchettes de prix de la boutique.
//
// Écrits ici, hors du composant : la barre d'outils, le compteur et la grille
// doivent partager exactement les mêmes règles. Deux définitions du même filtre
// finiraient par diverger, et le compte affiché deviendrait faux.

// Les fourchettes forment une PARTITION du catalogue : chaque prix tombe dans
// une tranche et une seule. C'est le point délicat — le prix médian est à
// CHF 12.90, dix produits valent exactement CHF 15.00 et trois exactement
// CHF 30.00. Des bornes qui se chevauchent les compteraient deux fois ; des
// bornes qui laissent un trou les feraient disparaître sans rien dire.
// Vérification : 99 + 60 + 14 + 4 = 177, soit le catalogue entier.
export const TRANCHES_PRIX = [
  { id: 'moins15', min: 0,  max: 15,       borneBasseIncluse: true,  borneHauteIncluse: false },
  { id: '15a30',   min: 15, max: 30,       borneBasseIncluse: true,  borneHauteIncluse: true },
  { id: '30a60',   min: 30, max: 60,       borneBasseIncluse: false, borneHauteIncluse: true },
  { id: 'plus60',  min: 60, max: Infinity, borneBasseIncluse: false, borneHauteIncluse: true },
];

export function dansLaTranche(prix, tranche) {
  const p = Number(prix);
  if (!Number.isFinite(p)) return false;
  const basse = tranche.borneBasseIncluse ? p >= tranche.min : p > tranche.min;
  const haute = tranche.borneHauteIncluse ? p <= tranche.max : p < tranche.max;
  return basse && haute;
}

// L'ordre de la boutique reste le tri par défaut.
//
// Il n'y a pas de tri « nouveautés » : le catalogue ne porte aucune date, et
// ses 177 produits ont été importés en un seul bloc depuis Wix. Leur ordre est
// celui de cet export, pas celui des créations — l'étiqueter « Nouveautés »
// serait affirmer une chronologie que rien ne soutient. Le jour où les fiches
// portent une date, le tri s'ajoute ici et nulle part ailleurs.
export const TRIS = ['boutique', 'prixCroissant', 'prixDecroissant', 'alpha'];

// L'ordre de la boutique n'est plus celui d'un fichier.
//
// Il était celui de l'export Wix : une suite subie, que rien ne permettait de
// changer. Une fiche porte maintenant un rang facultatif. Poser un rang sur une
// seule d'entre elles la remonte sans déranger les autres — celles qui n'en ont
// pas gardent leur suite d'origine, derrière. C'est ce qui rend le geste sûr :
// on ne renumérote pas 178 fiches pour en mettre une en avant.
function ordreBoutique(produits) {
  const rang = (p) => {
    const n = Number(p && p.ordre);
    return Number.isFinite(n) ? n : null;
  };
  const classees = produits.filter((p) => rang(p) !== null).sort((a, b) => rang(a) - rang(b));
  const reste = produits.filter((p) => rang(p) === null);
  return [...classees, ...reste];
}

export function trier(produits, tri) {
  if (tri === 'boutique' || !TRIS.includes(tri)) return ordreBoutique(produits);
  const copie = [...produits]; // `sort` modifie sur place : jamais le tableau source
  const prix = (p) => Number(p.price) || 0;
  if (tri === 'prixCroissant') return copie.sort((a, b) => prix(a) - prix(b));
  if (tri === 'prixDecroissant') return copie.sort((a, b) => prix(b) - prix(a));
  // Comparaison locale : sans elle, « Éclat » passerait après « Zeste ».
  return copie.sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'fr', { sensitivity: 'base' }));
}

// Point d'accroche laissé neutre à dessein : la signature 1 doit pouvoir
// regrouper les savons par recette sans qu'on reprenne la barre d'outils.
export function regrouper(produits, regroupement) {
  if (!regroupement || typeof regroupement !== 'function') return produits;
  return regroupement(produits);
}

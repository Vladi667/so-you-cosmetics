// Les treize rubriques de la boutique, dans l'ordre qu'elle a donné le 23 juin.
//
// Une seule source : le menu de bureau et le menu mobile listaient chacun les
// catégories en dur, ce qui garantissait qu'un jour les deux divergent.
export const SHOP_CATEGORIES = [
  'Soins Visage',
  'Soins Corps',
  'Soins Capillaires',
  'Savons',
  'Bain & Bien-être',
  'Maquillage',
  'Parfums',
  'Enfants',
  'DIY',
  'Ambiance',
  'Accessoires',
  'Cadeaux',
  'Personnalisation',
];

// Ne garde que les rubriques qui ont réellement des produits, en conservant son
// ordre.
//
// « Maquillage » n'a aujourd'hui aucun article : le soin des lèvres teinté est un
// soin, pas un maquillage. Afficher la rubrique quand même dirait au visiteur
// qu'il manque quelque chose, alors que son absence ne dit rien du tout — et le
// jour où elle ajoute un produit de maquillage, la rubrique réapparaît seule,
// sans qu'on ait à toucher au code.
export function visibleCategories(products) {
  if (!Array.isArray(products) || products.length === 0) return SHOP_CATEGORIES;
  const presentes = new Set();
  for (const p of products) {
    for (const c of p.collections || []) presentes.add(c);
  }
  const retenues = SHOP_CATEGORIES.filter((c) => presentes.has(c));

  // Puis celles qu'elle a créées elle-même, que cette liste ne connaît pas.
  //
  // Sans cela, taper « Coffrets de Noël » sur une fiche depuis l'administration
  // ne produisait rien : la rubrique n'apparaissait dans aucun menu, sans
  // erreur ni avertissement, et un produit qui n'aurait porté qu'elle devenait
  // inatteignable depuis la navigation. Sa liste garde son rang et son ordre —
  // c'est la raison d'être de ce fichier — et ce qui vient après la suit.
  const siennes = [...presentes].filter((c) => c && !SHOP_CATEGORIES.includes(c)).sort();

  const toutes = [...retenues, ...siennes];
  // Tant que le catalogue n'a pas été reclassé, aucune des nouvelles rubriques
  // n'existe : on montre la liste complète plutôt qu'un menu vide.
  return toutes.length > 0 ? toutes : SHOP_CATEGORIES;
}

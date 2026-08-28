// L'orgue à parfums : regrouper les savons par recette.
//
// Treize savons « olive, coco, ricin, palme RSPO » occupaient treize cartes du
// catalogue, identiques à la photo près. Ce n'est pas treize savons, c'est un
// savon en treize senteurs — et cherché comme treize produits, il noie la
// rubrique et cache le reste.
//
// Le regroupement est DÉRIVÉ à la lecture, jamais écrit dans le catalogue.
// C'est la variante que le plan recommande : elle retire toute écriture de
// données du poste, donc tout redémarrage, et laisse les champs persistés de la
// vague 10 disponibles si la dérivation s'avère trop fragile un jour.

// « Senteur » seulement, jamais « Parfum » : « Parfum d'ambiance pour
// diffuseur » n'est pas une variante de savon, et le mot suffisait à le happer.
const MOTIF_SENTEUR = /^(.*?)[\s,–-]*\bSenteur\b\s*[:-]?\s*(.+)$/i;

// Les mêmes ingrédients dans un autre ordre font la même recette. Deux fiches
// disent « olive, coco, ricin, palme RSPO » et deux autres « olive, coco, palme
// RSPO, ricin » : sans cette normalisation, elles formeraient deux familles
// pour un seul savon.
function cleDeRecette(base) {
  const nettoye = base.replace(/[\s,–-]+$/, '').trim();
  const separateur = nettoye.indexOf(' ');
  if (separateur < 0) return nettoye.toLowerCase();
  const tete = nettoye.slice(0, separateur);
  const ingredients = nettoye.slice(separateur + 1)
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .sort();
  return `${tete.toLowerCase()}|${ingredients.join(',')}`;
}

// Découpe un nom en { base, senteur }, ou null si le nom n'en porte pas.
export function lireRecette(nom) {
  const m = String(nom || '').match(MOTIF_SENTEUR);
  if (!m) return null;
  const base = m[1].replace(/[\s,–-]+$/, '').trim();
  const senteur = m[2].trim();
  if (!base || !senteur) return null;
  return { base, senteur, cle: cleDeRecette(base) };
}

// Remplace les variantes d'une même recette par une carte unique.
//
// Une famille d'un seul membre n'est pas une famille : elle reste la fiche
// normale, sans quoi on inventerait un regroupement pour rien.
export function grouperParRecette(produits) {
  if (!Array.isArray(produits)) return [];

  const familles = new Map();
  const sortie = [];

  for (const p of produits) {
    const r = lireRecette(p.name);
    if (!r) {
      sortie.push(p);
      continue;
    }
    if (!familles.has(r.cle)) {
      const groupe = { cle: r.cle, base: r.base, membres: [], position: sortie.length };
      familles.set(r.cle, groupe);
      sortie.push(groupe); // la place est réservée, le contenu se remplit ensuite
    }
    familles.get(r.cle).membres.push({ ...p, senteur: r.senteur });
  }

  return sortie.map((entree) => {
    if (!entree || !entree.membres) return entree;
    // Un seul membre : on rend la fiche telle quelle.
    if (entree.membres.length === 1) {
      const seul = entree.membres[0];
      return { ...seul, senteur: undefined };
    }

    const prix = entree.membres.map((m) => Number(m.price) || 0);
    const min = Math.min(...prix);
    const max = Math.max(...prix);

    // Règle non négociable : si les variantes n'ont pas le même prix, la carte
    // annonce « dès CHF X ». Afficher un prix unique quand il y en a plusieurs
    // reviendrait à promettre un montant que la caisse ne confirmera pas — le
    // serveur facture par identifiant, jamais ce que la carte affiche.
    return {
      // L'identifiant de la famille est celui de sa variante la moins chère :
      // c'est la fiche vers laquelle la carte mène, et son prix est celui
      // annoncé.
      id: entree.membres.reduce((a, b) => ((Number(a.price) || 0) <= (Number(b.price) || 0) ? a : b)).id,
      name: entree.base,
      estRecette: true,
      membres: entree.membres,
      senteurs: entree.membres.map((m) => m.senteur),
      price: min,
      prixVariable: max > min,
      images: entree.membres.flatMap((m) => (m.images || []).slice(0, 1)),
      collections: entree.membres[0].collections || [],
      ribbon: null,
      inStock: entree.membres.some((m) => m.inStock !== false),
    };
  });
}

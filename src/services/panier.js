// Le panier et les favoris, conservés entre les visites.
//
// Ils vivaient en mémoire seulement : fermer l'onglet, revenir depuis l'onglet
// de paiement, ou laisser Safari mobile purger la page suffisait à tout perdre.
// Sur un catalogue de 178 références où l'on hésite, un panier se construit sur
// plusieurs visites — celui-ci ne survivait pas à une seule.
//
// On ne conserve que {id, qty} : le prix et le nom sont relus dans le catalogue
// au montage. Garder l'objet produit entier revenait à figer un prix qui peut
// changer, et à ressusciter un produit qu'elle a retiré de la vente.

const CLE_PANIER = 'soyou.cart.v1';
const CLE_FAVORIS = 'soyou.favorites.v1';

// Au-delà, on considère que la visite d'origine est oubliée. Un panier de trois
// mois qui ressurgit avec d'anciens prix crée plus de confusion qu'il ne sauve
// de ventes.
const PEREMPTION_JOURS = 30;

// localStorage peut manquer (navigation privée, stockage plein) ou contenir
// n'importe quoi. Aucune de ces situations ne doit empêcher le site de
// s'afficher : dans le doute, on repart d'un panier vide.
function lire(cle) {
  try {
    const brut = localStorage.getItem(cle);
    if (!brut) return [];
    const data = JSON.parse(brut);
    if (!data || !Array.isArray(data.lignes)) return [];
    const age = Date.now() - (Number(data.date) || 0);
    if (age > PEREMPTION_JOURS * 24 * 3600 * 1000) return [];
    return data.lignes
      .filter((l) => l && typeof l.id === 'string')
      .map((l) => ({ id: l.id, qty: Math.max(1, parseInt(l.qty, 10) || 1), recharge: Boolean(l.recharge) }));
  } catch {
    return [];
  }
}

function ecrire(cle, lignes) {
  try {
    localStorage.setItem(cle, JSON.stringify({ date: Date.now(), lignes }));
  } catch {
    /* stockage indisponible : le panier reste en mémoire pour cette visite */
  }
}

// Ce qui distingue deux lignes du panier.
//
// L'identifiant ne suffit plus : le même savon liquide peut être acheté plein
// ou en recharge, à deux prix différents. Sans cette clé, les deux fusionnent
// en une seule ligne — et le prix affiché serait celui de la première ajoutée,
// pendant que le serveur facturerait chaque unité à son propre tarif.
export const cleLigne = (item) => `${item.id}|${item.recharge ? 'r' : ''}`;

export const lirePanier = () => lire(CLE_PANIER);
export const lireFavoris = () => lire(CLE_FAVORIS);

// On n'écrit que l'identifiant et la quantité, quelle que soit la forme reçue.
export const ecrirePanier = (items) =>
  ecrire(CLE_PANIER, items.map((p) => ({ id: p.id, qty: p.qty || 1, recharge: Boolean(p.recharge) })));
export const ecrireFavoris = (items) =>
  ecrire(CLE_FAVORIS, items.map((p) => ({ id: p.id, qty: 1 })));

// Redonne à des lignes {id, qty} leur produit complet, au prix du catalogue.
//
// Sans cette étape, le tiroir lit un `price` absent et affiche « CHF NaN », puis
// le serveur refuse la commande. Une ligne dont l'identifiant n'existe plus est
// retirée en silence : le produit a été supprimé, il n'y a rien à proposer.
export function resoudre(lignes, catalogue) {
  if (!Array.isArray(lignes) || !Array.isArray(catalogue)) return [];
  const parId = new Map(catalogue.map((p) => [String(p.id), p]));
  const sortie = [];
  for (const l of lignes) {
    const produit = parId.get(String(l.id));
    if (!produit) continue;
    // Le prix affiché suit la variante : une recharge se lit à son prix de
    // recharge, qui est celui que le serveur facturera pour cette ligne.
    const recharge = Boolean(l.recharge) && Number(produit.rechargePrix) > 0;
    sortie.push({
      ...produit,
      qty: Math.max(1, parseInt(l.qty, 10) || 1),
      recharge,
      price: recharge ? Number(produit.rechargePrix) : produit.price,
    });
  }
  return sortie;
}

// Ajoute un produit en fusionnant les quantités.
//
// Avant, chaque ajout empilait une ligne de plus : commander six savons donnait
// six lignes identiques, illisibles, et aucun moyen d'ajuster une quantité sans
// tout supprimer.
export function ajouter(items, produit, quantite = 1) {
  const q = Math.max(1, parseInt(quantite, 10) || 1);
  // On fusionne sur la clé de ligne, pas sur l'identifiant seul : un plein et
  // une recharge du même produit restent deux lignes, à deux prix.
  const cle = cleLigne(produit);
  const i = items.findIndex((p) => cleLigne(p) === cle);
  if (i === -1) return [...items, { ...produit, qty: q }];
  return items.map((p, k) => (k === i ? { ...p, qty: (p.qty || 1) + q } : p));
}

// Fixe la quantité d'une ligne ; zéro ou moins la retire.
// `reference` accepte la ligne entière (recommandé) ou un simple identifiant,
// pour ne pas casser les appelants d'avant la recharge.
export function fixerQuantite(items, reference, quantite) {
  const cle = typeof reference === 'string' ? `${reference}|` : cleLigne(reference);
  const q = parseInt(quantite, 10);
  if (!Number.isFinite(q) || q <= 0) return items.filter((p) => cleLigne(p) !== cle);
  return items.map((p) => (cleLigne(p) === cle ? { ...p, qty: q } : p));
}

export const totalPanier = (items) =>
  items.reduce((s, p) => s + (Number(p.price) || 0) * (p.qty || 1), 0);

export const nombreArticles = (items) =>
  items.reduce((s, p) => s + (p.qty || 1), 0);

// Ouvrir le tiroir du panier depuis n'importe où.
//
// Le tiroir appartient à App ; la fiche produit et les cartes du catalogue en
// sont séparées par trois composants intermédiaires. Faire descendre un rappel
// jusqu'à elles obligerait Home, CategoryPage et SearchPage à transporter une
// prop qui ne les concerne pas. Un évènement laisse chacun l'ignorer.
export const EVT_OUVRIR_PANIER = 'soyou:ouvrir-panier';
export const ouvrirPanier = () => window.dispatchEvent(new CustomEvent(EVT_OUVRIR_PANIER));

// Le petit sursaut de l'icône du panier, à chaque ajout.
//
// C'était `style.animation = 'none'` puis un setTimeout de 10 ms pour forcer un
// recalcul et relancer la même animation CSS. Deux ajouts rapprochés se
// marchaient dessus. L'API d'animations relance proprement, sans minuterie.
export function sursautPanier(element) {
  if (!element || typeof element.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  element.animate(
    [
      { transform: 'scale(1)' },
      { transform: 'scale(1.28)', offset: 0.35 },
      { transform: 'scale(0.94)', offset: 0.7 },
      { transform: 'scale(1)' },
    ],
    { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
  );
}

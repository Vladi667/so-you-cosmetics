// Shop settings she controls from the admin: opening hours, an absence notice,
// and maintenance mode. Injected into the page by the server before it is sent
// (see server/index.js), exactly like the content overrides — so they are read
// synchronously and there is no moment where the old hours are on screen.
//
// Every accessor tolerates the value being absent: if the injection ever fails,
// the site falls back to what it showed before this existed rather than to a
// blank panel.
const shop = (typeof window !== 'undefined' && window.__SHOP__) || {};

// The hours the site displayed when they were hard-coded, kept as the floor.
const DEFAULT_HOURS = [
  { day: 'lundi', closed: true, hours: '' },
  { day: 'mardi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'mercredi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'jeudi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'vendredi', closed: false, hours: '11:00–13:00 / 14:00–18:30' },
  { day: 'samedi', closed: false, hours: '11:00–16:30' },
];

export function getHours() {
  return Array.isArray(shop.hours) && shop.hours.length > 0 ? shop.hours : DEFAULT_HOURS;
}

// The notice she puts up when she is away — typically about dispatch delays.
// Returns null unless she has both switched it on and written something in the
// current language (or in French, which every language falls back to).
export function getAbsenceNotice(language) {
  const a = shop.absence;
  if (!a || !a.active) return null;
  const text = a[language] || a.fr;
  return text ? String(text) : null;
}

// Les modes d'expédition qu'elle propose, et le seuil de franchise.
// La franchise ne s'applique qu'à l'option marquée « economy » — c'est aussi ce
// que le serveur applique, qui reste seul juge du montant facturé.
export function getShipping() {
  const sh = shop.shipping;
  if (!sh || !Array.isArray(sh.options) || sh.options.length === 0) {
    return { freeFrom: 0, options: [] };
  }
  return { freeFrom: Number(sh.freeFrom) || 0, options: sh.options };
}

// Ce que coûtera l'option choisie pour ce montant de panier. Sert à l'affichage
// uniquement : le serveur recalcule tout au moment de la commande.
export function shippingCostFor(option, goodsTotal) {
  if (!option) return 0;
  const { freeFrom } = getShipping();
  if (option.economy && freeFrom > 0 && goodsTotal >= freeFrom) return 0;
  return Number(option.price) || 0;
}

// Les modes d'expédition qui ne demandent pas d'adresse.
//
// Même règle que côté serveur, et pour la même raison : on n'exempte QUE le
// retrait en boutique. Écrire la condition dans l'autre sens — « exiger une
// adresse pour les modes postaux connus » — laisserait passer sans adresse tout
// mode ajouté plus tard, et le serveur refuserait alors une commande que le
// formulaire aurait acceptée.
const MODES_SANS_ADRESSE = new Set(['pickup']);

export const exigeAdresse = (shippingId) => !MODES_SANS_ADRESSE.has(String(shippingId || ''));


// L'emballage cadeau, tel que le serveur l'a publié. Le prix affiché à la
// caisse vient donc de la même source que celui qui sera facturé.
export function getGiftWrap() {
  const reglages = (typeof window !== 'undefined' && window.__SHOP__) || {};
  const g = reglages.giftWrap || {};
  return { enabled: Boolean(g.enabled), price: Number(g.price) || 0 };
}

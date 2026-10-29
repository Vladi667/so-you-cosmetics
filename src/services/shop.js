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

// Les modes qu'elle réserve aux bons cadeaux.
//
// Même liste et même raisonnement que côté serveur : ses quatre tarifs Courrier
// portent la mention « Bon cadeau uniquement », parce qu'un bon tient dans une
// enveloppe et pas un colis de savons. On filtre ici pour ne pas proposer un
// tarif que la commande se verra refuser à la fin — mais c'est le serveur qui
// tranche, le navigateur ne fait que de la courtoisie.
const MODES_BON_CADEAU = new Set(['courrierB', 'courrierBsig', 'courrierA', 'courrierAsig']);

export function estBonCadeau(produit) {
  if (!produit) return false;
  if (produit.estBonCadeau === true) return true;
  const texte = `${produit.name || ''} ${(produit.collections || []).join(' ')}`;
  return /bon\s+cadeau|carte\s+cadeau|gift\s+(card|voucher)/i.test(texte);
}

// Un seul article ordinaire parmi les bons suffit à en faire un colis.
export function modeAutorise(shippingId, articles) {
  if (!MODES_BON_CADEAU.has(String(shippingId || ''))) return true;
  const lignes = Array.isArray(articles) ? articles : [];
  return lignes.length > 0 && lignes.every(estBonCadeau);
}

// Ouverte ou fermée, maintenant, à Genève — et sinon, quand elle rouvre.
//
// Lu dans les horaires qu'elle saisit elle-même (« 11:00–13:00 / 14:00–18:30 »),
// pour que le site ne dise jamais « ouvert » d'après d'anciennes heures. Un jour
// absent de la liste est un jour fermé, comme le dimanche.
//
// Rien n'est affirmé quand elle a activé son message d'absence : ses vacances
// ne sont pas dans les horaires, et annoncer « ouvert » devant une porte close
// coûterait plus qu'un silence. Même prudence si les horaires sont illisibles.
//
// Renvoie null, ou { ouvert, jusqua, pause } ou { ouvert: false, dans, heure,
// date } — `dans` étant le nombre de jours avant la réouverture.
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function plages(texte) {
  const out = [];
  const re = /(\d{1,2})[:h.](\d{2})\s*[–—-]\s*(\d{1,2})[:h.](\d{2})/g;
  let m;
  while ((m = re.exec(String(texte || '')))) {
    out.push([Number(m[1]) * 60 + Number(m[2]), Number(m[3]) * 60 + Number(m[4])]);
  }
  return out;
}

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// L'heure de Genève, quel que soit le fuseau de l'appareil qui consulte.
function maintenantGeneve(date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date).map((x) => [x.type, x.value])
  );
  const jour = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday);
  return { jour, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

export function statutBoutique(date = new Date()) {
  if (shop.absence && shop.absence.active) return null;
  const parJour = JOURS.map(() => []);
  for (const h of getHours()) {
    const i = JOURS.indexOf(String(h.day || '').toLowerCase());
    if (i !== -1 && !h.closed) parJour[i] = plages(h.hours);
  }
  if (parJour.every((p) => p.length === 0)) return null;

  const { jour, minutes } = maintenantGeneve(date);
  // Fermée exceptionnellement aujourd'hui (décidé au comptoir) : on cherche la
  // réouverture à partir de demain.
  const fermeeAujourdhui = shop.fermeLe && shop.fermeLe === date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
  const aujourdhui = fermeeAujourdhui ? [] : parJour[jour];
  const enCours = aujourdhui.find(([a, b]) => minutes >= a && minutes < b);
  if (enCours) return { ouvert: true, jusqua: hhmm(enCours[1]) };

  for (let d = fermeeAujourdhui ? 1 : 0; d < 8; d++) {
    const j = (jour + d) % 7;
    const prochaine = parJour[j].find(([a]) => d > 0 || a > minutes);
    if (prochaine) {
      return {
        ouvert: false,
        exceptionnel: Boolean(fermeeAujourdhui),
        // Entre deux plages du même jour : la pause de midi, pas une fermeture.
        pause: d === 0 && aujourdhui.some(([, b]) => b <= minutes),
        dans: d,
        heure: hhmm(prochaine[0]),
        date: new Date(date.getTime() + d * 86400000),
      };
    }
  }
  return null;
}

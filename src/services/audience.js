// Ce que le navigateur transmet à la mesure d'audience (server/audience.js).
//
// Aucun cookie, aucun identifiant. Le seul souvenir gardé est dans
// sessionStorage, propre à l'onglet et effacé à sa fermeture : la provenance de
// la visite, lue sur sa première page. Il sert à deux choses — ne compter la
// visite qu'une fois, et dire à la commande d'où l'on venait.

const CLE = 'soyou-visite';

// Si sessionStorage est refusé (navigation privée stricte), la variable suffit
// tant que l'onglet reste sur le site : l'application ne recharge pas la page
// en changeant d'adresse.
let enMemoire = null;

function lire() {
  if (enMemoire) return enMemoire;
  try {
    const s = sessionStorage.getItem(CLE);
    if (s) enMemoire = JSON.parse(s);
  } catch { /* sans stockage : la mémoire de l'onglet suffit */ }
  return enMemoire;
}

function provenance() {
  const p = new URLSearchParams(window.location.search);
  const source = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign']) {
    const v = p.get(k);
    if (v) source[k] = v.slice(0, 80);
  }
  // L'identifiant de clic Google Ads est gardé tel quel : joint à une
  // commande payée, il permet de dire à Google Ads quelle annonce a fait
  // vendre, sans son traceur à cookies. Il ne sert à rien d'autre.
  for (const k of ['gclid', 'gbraid', 'wbraid']) {
    const v = p.get(k);
    if (v) source[k] = v.slice(0, 200);
  }
  // Pour Meta, la présence suffit.
  if (p.has('fbclid')) source.fbclid = true;
  // L'origine seule, sans chemin : l'adresse exacte d'une page de résultats
  // peut contenir ce que la personne a cherché.
  try {
    if (document.referrer) source.referrer = new URL(document.referrer).origin;
  } catch { /* adresse illisible : on n'en dit rien */ }
  return source;
}

// À appeler à chaque changement de page.
export function noterPage(chemin) {
  let visite = lire();
  const nouvelle = !visite;
  if (nouvelle) {
    visite = { source: provenance() };
    enMemoire = visite;
    try { sessionStorage.setItem(CLE, JSON.stringify(visite)); } catch { /* idem */ }
  }
  envoyer(JSON.stringify({ chemin, nouvelle, source: nouvelle ? visite.source : undefined }));
}

function envoyer(corps) {
  try {
    // sendBeacon survit au départ vers Maps ou vers le téléphone.
    if (navigator.sendBeacon && navigator.sendBeacon('/api/audience', new Blob([corps], { type: 'application/json' }))) return;
  } catch { /* on retombe sur fetch */ }
  fetch('/api/audience', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: corps, keepalive: true }).catch(() => {});
}

// Un geste vers la boutique : 'itineraire', 'appel' ou 'carte'. Porte la
// provenance de la visite, pour savoir quel canal fait venir du monde.
export function noterAction(action) {
  const v = lire();
  envoyer(JSON.stringify({ action, source: v ? v.source : {} }));
}

// La provenance de la visite en cours, jointe à la commande.
export function sourceVisite() {
  const v = lire();
  return v ? v.source : null;
}

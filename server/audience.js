// La mesure d'audience, faite par le site lui-même.
//
// Le contrat marketing (Fritz, proposition B) promet une mesure « sans cookie
// ni bannière — pour savoir ce qui entre, et d'où ». Plausible l'aurait fait
// contre un abonnement ; Google Analytics ne l'aurait pas fait du tout sans
// bannière. Ce qu'on veut savoir tient en peu de chose : combien de visites,
// venues d'où, sur quelles pages, et lesquelles finissent en commande. Le site
// peut le compter seul.
//
// Ce qui est gardé : des TOTAUX PAR JOUR — visites, pages vues, provenance,
// campagne, page. Ni adresse IP, ni identifiant, ni empreinte du navigateur :
// rien ne permet de relier deux visites à la même personne, et il n'y a donc
// rien à demander à personne. Une « visite » est un onglet ouvert sur le site ;
// le navigateur le sait seul (sessionStorage), sans rien envoyer qui le
// désigne.
//
// La provenance est classée ICI, une fois, et pas dans le navigateur : la même
// fonction classe la visite et la commande, si bien que « Google Ads » veut
// dire la même chose dans les deux colonnes du tableau.

const fs = require('node:fs');
const path = require('node:path');

const FICHIER = path.join(__dirname, 'data', 'audience.json');
const JOURS_GARDES = 400;
// Un plafond par jour et par liste : sans lui, n'importe qui pourrait remplir
// le fichier d'adresses inventées. Au-delà, le reste est compté sous « Autres ».
const PLAFOND_CLES = 300;

const MOTEURS = /(^|\.)(google|bing|duckduckgo|ecosia|qwant|yahoo|startpage|brave|yandex|baidu)\./i;
const ANNUAIRES = /(^|\.)(local\.ch|search\.ch|tel\.search\.ch|yelp\.|tripadvisor\.)/i;
const RESEAUX = /(^|\.)(facebook\.com|fb\.com|instagram\.com|t\.co|twitter\.com|x\.com|pinterest\.|linkedin\.com|tiktok\.com|youtube\.com|threads\.net)$/i;
const ROBOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|node-fetch|axios/i;

// Le domaine de la boutique, pour ne pas prendre une page du site pour une
// provenance : passer de l'accueil à une fiche n'est pas « venir d'un autre site ».
const MAISON = /(^|\.)soyoucosmetics\.(com|ch)$|^localhost$|^127\.0\.0\.1$/i;

function texte(v, max = 80) {
  return String(v == null ? '' : v).trim().slice(0, max);
}

function hote(referrer) {
  try {
    return new URL(String(referrer)).hostname.toLowerCase().replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

// D'où vient une visite. Reçoit ce que le navigateur a vu sur la PREMIÈRE page
// de la visite : les paramètres utm_*, la présence d'un gclid ou d'un fbclid,
// et l'adresse d'où l'on arrivait.
//
// L'ordre compte. Le paramètre utm, posé à la main sur un lien d'annonce ou
// d'infolettre, dit ce que l'expéditeur voulait dire ; il passe avant tout.
// Le gclid, ajouté par Google Ads lui-même, vient ensuite. Le fbclid, lui, ne
// prouve PAS une annonce : Meta l'ajoute aussi aux liens ordinaires partagés
// sur Facebook et Instagram.
function classer(brut = {}) {
  const src = texte(brut.utm_source).toLowerCase();
  const med = texte(brut.utm_medium).toLowerCase();
  const campagne = texte(brut.utm_campaign);
  const h = hote(brut.referrer);
  const payant = /cpc|ppc|paid|ads?$|display|cpm|retargeting/.test(med);

  let canal;
  if (src || med) {
    if (/^(google|adwords)/.test(src) && payant) canal = 'Google Ads';
    else if (/^(facebook|fb|instagram|ig|meta)/.test(src) && payant) canal = 'Meta Ads';
    else if (/e-?mail|newsletter|infolettre/.test(med) || /newsletter|infolettre/.test(src)) canal = 'Infolettre';
    else if (/^(google|bing)/.test(src) && /organic/.test(med)) canal = 'Recherche';
    else if (/google.?business|gbp|maps/.test(src) || /google.?business|gbp/.test(med)) canal = 'Fiche Google';
    else if (/^(facebook|fb|instagram|ig|meta|pinterest|tiktok|linkedin)/.test(src) || /social/.test(med)) canal = 'Réseaux sociaux';
    else if (payant) canal = 'Autre publicité';
    else canal = 'Autre lien';
  } else if (brut.gclid || brut.gbraid || brut.wbraid) {
    canal = 'Google Ads';
  } else if (h && !MAISON.test(h)) {
    if (ANNUAIRES.test(h)) canal = 'Annuaires';
    else if (MOTEURS.test(h)) canal = 'Recherche';
    else if (RESEAUX.test(h) || brut.fbclid) canal = 'Réseaux sociaux';
    else canal = 'Autre site';
  } else if (brut.fbclid) {
    canal = 'Réseaux sociaux';
  } else {
    canal = 'Direct';
  }

  return {
    canal,
    // Ce qui précise le canal : la source utm, sinon le site d'origine.
    detail: src || (h && !MAISON.test(h) ? h : ''),
    campagne,
  };
}

// Les identifiants de clic Google Ads, s'il y en a. Ils ne vont qu'AVEC LA
// COMMANDE — jamais dans les totaux de visites — et ne servent qu'à une chose :
// dire à Google Ads quelle annonce a fait vendre, sans son traceur à cookies
// (voir csvConversionsGoogle). gbraid et wbraid remplacent le gclid sur les
// appareils Apple.
function clicGoogle(brut = {}) {
  const propre = (v) => (typeof v === 'string' && /^[A-Za-z0-9_-]{10,200}$/.test(v) ? v : '');
  const clic = {};
  for (const k of ['gclid', 'gbraid', 'wbraid']) {
    const v = propre(brut[k]);
    if (v) clic[k] = v;
  }
  return Object.keys(clic).length ? clic : null;
}

// Les ventes à renvoyer à Google Ads, au format de son import de conversions
// « à partir des clics ». Google Ads va lire ce fichier lui-même chaque jour
// (import programmé par HTTPS) ; il ignore les lignes déjà reçues, si bien que
// répéter les mêmes ventes d'un jour à l'autre ne les compte pas deux fois.
//
// Ce qui part chez Google : l'identifiant de clic qu'il a lui-même ajouté au
// lien, l'heure et le montant. Ni nom, ni adresse, ni e-mail.
//
// Le nom de la conversion doit être EXACTEMENT celui de l'action créée dans
// Google Ads : une différence d'une lettre, et chaque ligne est refusée.
const NOM_CONVERSION = 'Achat en ligne';
const STATUTS_PAYES = ['paid', 'readyforpickup', 'shipped'];

function heureLocale(iso) {
  // « sv-SE » donne AAAA-MM-JJ HH:MM:SS, le format attendu par Google.
  return new Date(iso).toLocaleString('sv-SE', { timeZone: 'Europe/Zurich', hour12: false });
}

function csvConversionsGoogle(commandes, maintenant = Date.now()) {
  // Google n'accepte plus un clic de plus de 90 jours.
  const limite = maintenant - 90 * 86400000;
  const lignes = (commandes || [])
    .filter((o) => o && o.source && o.source.clic && o.source.clic.gclid)
    .filter((o) => STATUTS_PAYES.includes(String(o.status || '').toLowerCase()))
    .filter((o) => new Date(o.created_at).getTime() >= limite)
    .map((o) => [
      o.source.clic.gclid,
      NOM_CONVERSION,
      heureLocale(o.created_at),
      (Number(o.total) || 0).toFixed(2),
      'CHF',
    ].join(','));
  return [
    'Parameters:TimeZone=Europe/Zurich',
    'Google Click ID,Conversion Name,Conversion Time,Conversion Value,Conversion Currency',
    ...lignes,
  ].join('\r\n') + '\r\n';
}

// --- Les totaux ------------------------------------------------------------

let donnees = null;
let sale = false;

function charger() {
  if (donnees) return donnees;
  try {
    const d = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    donnees = d && typeof d.jours === 'object' ? d : { jours: {} };
  } catch (_) {
    donnees = { jours: {} };
  }
  return donnees;
}

// Le jour à Genève, pas en UTC : une visite à 00h30 appartient au jour qui
// commence, pas à la veille.
function jourLocal(date = new Date()) {
  return date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Zurich' });
}

function jour(cle) {
  const d = charger();
  if (!d.jours[cle]) {
    d.jours[cle] = { vues: 0, visites: 0, canaux: {}, detail: {}, campagnes: {}, pages: {}, entrees: {}, actions: {}, actionsCanaux: {} };
  }
  return d.jours[cle];
}

function ajouter(table, cle, n = 1) {
  if (!cle) return;
  if (!(cle in table) && Object.keys(table).length >= PLAFOND_CLES) cle = 'Autres';
  table[cle] = (table[cle] || 0) + n;
}

// Un chemin propre : sans paramètres, sans fragment, d'une longueur sensée.
function cheminPropre(c) {
  const s = texte(c, 200).split(/[?#]/)[0];
  return s.startsWith('/') ? s : '';
}

function estRobot(userAgent) {
  return !userAgent || ROBOTS.test(userAgent);
}

// Une page vue. `nouvelle` marque la première page d'une visite : c'est elle,
// et elle seule, qui porte la provenance.
function noter({ chemin, nouvelle, source }, userAgent) {
  if (estRobot(userAgent)) return false;
  const c = cheminPropre(chemin);
  if (!c || /^\/(?:[a-z]{2}\/)?admin/.test(c)) return false;

  const j = jour(jourLocal());
  j.vues += 1;
  ajouter(j.pages, c);
  if (nouvelle) {
    const s = classer(source || {});
    j.visites += 1;
    ajouter(j.canaux, s.canal);
    if (s.detail) ajouter(j.detail, `${s.canal} · ${s.detail}`);
    if (s.campagne) ajouter(j.campagnes, s.campagne);
    ajouter(j.entrees, c);
  }
  sale = true;
  return true;
}

// Un geste qui mène à la boutique : demander l'itinéraire, appeler, ouvrir la
// carte. Aucun site ne voit une vente au comptoir ; ces gestes sont ce qui s'en
// approche le plus, et ils se rangent par la provenance de la visite comme les
// ventes en ligne — c'est ce qui dit si une annonce fait venir du monde.
const ACTIONS = ['itineraire', 'appel', 'carte'];

function noterAction({ action, source }, userAgent) {
  if (estRobot(userAgent) || !ACTIONS.includes(action)) return false;
  const j = jour(jourLocal());
  j.actions = j.actions || {};
  j.actionsCanaux = j.actionsCanaux || {};
  ajouter(j.actions, action);
  ajouter(j.actionsCanaux, `${classer(source || {}).canal}|${action}`);
  sale = true;
  return true;
}

function ecrire() {
  if (!sale || !donnees) return;
  // Les jours trop anciens partent à l'écriture, pas à la lecture.
  const limite = jourLocal(new Date(Date.now() - JOURS_GARDES * 86400000));
  for (const k of Object.keys(donnees.jours)) if (k < limite) delete donnees.jours[k];
  try {
    const tmp = FICHIER + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(donnees));
    fs.renameSync(tmp, FICHIER);
    sale = false;
  } catch (err) {
    console.error('Audience : écriture impossible', err.message);
  }
}

// Écrit une fois par minute, et à l'arrêt : un redémarrage depuis le Manager
// ne doit pas faire perdre la dernière minute.
const minuterie = setInterval(ecrire, 60 * 1000);
if (minuterie.unref) minuterie.unref();
process.once('beforeExit', ecrire);
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.once(sig, () => { ecrire(); process.exit(0); });
}

// Les totaux d'une période, de `debut` à `fin` inclus (AAAA-MM-JJ).
function periode(debut, fin) {
  const d = charger();
  const somme = { vues: 0, visites: 0, canaux: {}, detail: {}, campagnes: {}, pages: {}, entrees: {}, actions: {}, actionsCanaux: {} };
  const parJour = [];
  const curseur = new Date(`${debut}T12:00:00Z`);
  const borne = new Date(`${fin}T12:00:00Z`);
  while (curseur <= borne) {
    const cle = curseur.toISOString().slice(0, 10);
    const j = d.jours[cle];
    parJour.push({ date: cle, visites: j ? j.visites : 0, vues: j ? j.vues : 0 });
    if (j) {
      somme.vues += j.vues;
      somme.visites += j.visites;
      for (const t of ['canaux', 'detail', 'campagnes', 'pages', 'entrees', 'actions', 'actionsCanaux']) {
        for (const [k, n] of Object.entries(j[t] || {})) somme[t][k] = (somme[t][k] || 0) + n;
      }
    }
    curseur.setUTCDate(curseur.getUTCDate() + 1);
  }
  return { ...somme, parJour };
}

module.exports = { noterAction, classer, clicGoogle, csvConversionsGoogle, NOM_CONVERSION, STATUTS_PAYES, noter, periode, jourLocal, ecrire, estRobot };

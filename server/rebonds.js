// Les rebonds : ce qui arrive quand une adresse ne répond plus.
//
// Une liste de diffusion pourrit toute seule. Les gens changent d'employeur,
// ferment une boîte, laissent une adresse se remplir. Sans rien faire, on
// continue d'écrire à des boîtes mortes — et ce n'est pas seulement inutile :
// les fournisseurs de messagerie comptent les échecs, et un expéditeur qui
// insiste finit dans les indésirables de celles qui, elles, existent encore.
//
// LA DISTINCTION QUI COMMANDE TOUT. Un échec d'envoi ne dit pas forcément que
// l'adresse est mauvaise. Il y en a deux sortes, et les confondre serait pire
// que de ne rien faire :
//
//   Définitif  — « no such user », « mailbox unavailable », les codes 5xx.
//                La boîte n'existe pas. Insister ne servira jamais à rien :
//                l'adresse est écartée dès le premier échec.
//
//   Passager   — un serveur injoignable, une boîte pleine, un 4xx, notre
//                propre SMTP en panne. L'adresse est probablement bonne. On
//                compte, et il faut trois échecs pour l'écarter — sans quoi
//                une panne de trente minutes de notre côté viderait la liste
//                entière d'un coup.
//
// Le second point est le vrai piège : c'est le jour où le SMTP tombe qu'un
// traitement naïf des rebonds fait le plus de dégâts.

const fs = require('node:fs');
const path = require('node:path');

const FICHIER = path.join(__dirname, 'data', 'adresses_infolettre.json');

// Trois échecs passagers avant d'écarter. Un définitif suffit.
const SEUIL_PASSAGERS = 3;

function lire() {
  try {
    const d = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch (_) {
    return [];
  }
}

function ecrire(liste) {
  const tmp = FICHIER + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(liste, null, 2));
  fs.renameSync(tmp, FICHIER);
}

const normaliser = (e) => String(e || '').trim().toLowerCase();

// Définitif ou passager ? On lit d'abord le code, puis le texte.
//
// Le code SMTP est la source la plus sûre : la classe 5 est permanente, la 4
// temporaire, c'est la norme et non une convention locale. Le texte ne sert
// qu'à défaut de code — les serveurs le formulent chacun à leur manière, mais
// quelques tournures reviennent partout.
function estDefinitif({ code, message, reponse } = {}) {
  const n = Number(code);
  if (Number.isFinite(n) && n >= 500 && n < 600) return true;
  if (Number.isFinite(n) && n >= 400 && n < 500) return false;

  const texte = `${message || ''} ${reponse || ''}`.toLowerCase();

  // Une boîte pleine ou un serveur occupé : l'adresse existe, elle est juste
  // indisponible. À vérifier AVANT les tournures définitives, parce que
  // « mailbox full » contient « mailbox ».
  if (/mailbox full|over quota|quota exceeded|try again|temporarily|greylist|too many|timeout|timed out|econnrefused|econnreset|enotfound|socket/i.test(texte)) {
    return false;
  }
  return /no such user|user unknown|unknown user|recipient (address )?rejected|does not exist|doesn't exist|mailbox unavailable|invalid (recipient|address)|address rejected|user not found|no mailbox/i.test(texte);
}

function fiche(email) {
  const e = normaliser(email);
  return lire().find((a) => a.email === e) || null;
}

function enregistrer(a) {
  const liste = lire();
  const i = liste.findIndex((x) => x.email === a.email);
  if (i === -1) liste.push(a);
  else liste[i] = a;
  ecrire(liste);
  return a;
}

// Un échec constaté. Renvoie ce qui a été décidé, pour que l'appelant puisse
// le dire à l'écran.
function noterEchec(email, cause, origine = 'envoi') {
  const e = normaliser(email);
  if (!e) return null;
  const definitif = estDefinitif(cause);
  const a = fiche(e) || { email: e, echecs: 0, ecartee: false, historique: [] };

  a.echecs = definitif ? SEUIL_PASSAGERS : a.echecs + 1;
  a.dernier = new Date().toISOString();
  a.motif = (cause && cause.message) || 'échec inconnu';
  a.code = (cause && cause.code) || null;
  a.definitif = definitif;
  a.origine = origine;
  a.historique = [...(a.historique || []).slice(-9), {
    quand: a.dernier, motif: a.motif, code: a.code, definitif, origine,
  }];

  if (!a.ecartee && a.echecs >= SEUIL_PASSAGERS) {
    a.ecartee = true;
    a.ecartee_le = a.dernier;
  }
  enregistrer(a);
  return { ecartee: a.ecartee, definitif, echecs: a.echecs };
}

// Un envoi réussi efface l'ardoise : une adresse qui répond de nouveau après
// deux incidents passagers ne doit pas rester à deux échecs pour toujours.
function noterSucces(email) {
  const a = fiche(email);
  if (!a || a.ecartee || a.echecs === 0) return;
  a.echecs = 0;
  a.motif = null;
  enregistrer(a);
}

const estEcartee = (email) => Boolean((fiche(email) || {}).ecartee);

const ecartees = () => lire().filter((a) => a.ecartee);

// Réintégrer : elle a corrigé l'adresse, ou la personne s'est réinscrite.
function reintegrer(email) {
  const a = fiche(email);
  if (!a) return false;
  a.ecartee = false;
  a.echecs = 0;
  a.motif = null;
  a.reintegree_le = new Date().toISOString();
  enregistrer(a);
  return true;
}

function oublier(email) {
  const e = normaliser(email);
  const liste = lire();
  const reste = liste.filter((a) => a.email !== e);
  if (reste.length === liste.length) return false;
  ecrire(reste);
  return true;
}

// ── Les avis de non-remise arrivés dans la boîte ──────────────────────────
//
// L'autre moitié du problème. Un serveur accepte souvent le message, puis
// renonce et renvoie un avis quelques minutes plus tard : l'envoi a donc
// « réussi » alors que personne ne l'a lu. Ces avis-là ne se voient que dans la
// boîte de réception.
//
// On les reconnaît à l'expéditeur — MAILER-DAEMON, postmaster — et à l'objet.
// Ce n'est pas une science exacte, et c'est assumé : une relève manquée ne
// coûte qu'un rebond détecté au prochain envoi, tandis qu'un faux positif
// écarterait une cliente réelle. Le doute profite donc à l'adresse.
const EXPEDITEURS = /mailer-daemon|postmaster|mail delivery (subsystem|system)|no-?reply@.*(bounce|mail)/i;
const OBJETS = /undelivered mail|delivery status notification|delivery failure|returned to sender|mail delivery failed|failure notice|non[- ]remise|échec de (la )?remise/i;

function estUnAvisDeNonRemise({ from = [], subject = '' } = {}) {
  const expediteur = (from || []).map((f) => `${f.name || ''} ${f.address || ''}`).join(' ');
  return EXPEDITEURS.test(expediteur) || OBJETS.test(subject || '');
}

// L'adresse en cause, extraite du corps de l'avis.
//
// Le format normalisé (RFC 3464) porte « Final-Recipient: rfc822; adresse ».
// Quand il manque, on retombe sur la première adresse citée qui ne soit ni la
// nôtre ni celle du démon — approximatif, mais c'est mieux que rien, et une
// erreur ici ne fait qu'ignorer un rebond.
function adresseEnCause(corps, nosDomaines = []) {
  const texte = String(corps || '');
  const officiel = texte.match(/Final-Recipient:\s*rfc822;\s*<?([^\s>;]+@[^\s>;]+)/i)
    || texte.match(/Original-Recipient:\s*rfc822;\s*<?([^\s>;]+@[^\s>;]+)/i);
  if (officiel) return normaliser(officiel[1]);

  const toutes = texte.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  for (const brute of toutes) {
    const e = normaliser(brute);
    if (/mailer-daemon|postmaster/i.test(e)) continue;
    if (nosDomaines.some((d) => e.endsWith('@' + d))) continue;
    return e;
  }
  return null;
}

// Le code d'état, quand l'avis le donne : « Status: 5.1.1 ».
function codeDeLAvis(corps) {
  const m = String(corps || '').match(/Status:\s*([245])\.\d+\.\d+/i);
  if (!m) return null;
  return Number(m[1]) * 100;   // 5.1.1 → 500, 4.2.2 → 400
}

module.exports = {
  FICHIER,
  SEUIL_PASSAGERS,
  estDefinitif,
  noterEchec,
  noterSucces,
  estEcartee,
  ecartees,
  reintegrer,
  oublier,
  lire,
  fiche,
  estUnAvisDeNonRemise,
  adresseEnCause,
  codeDeLAvis,
};

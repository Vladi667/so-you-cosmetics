// Les comptes clientes.
//
// Elles peuvent déjà commander sans compte, et cela ne changera pas : demander
// une inscription avant d'acheter fait perdre des ventes. Le compte sert à
// RELIRE — « voir ses anciennes commandes », comme le demandait Catherine.
//
// Trois choix de fond, écrits ici parce qu'ils ne se devinent pas à la lecture
// du code :
//
// 1. Les mots de passe passent par scrypt, pas par le HMAC-SHA256 qui protège
//    le mot de passe administrateur. Un HMAC est instantané à calculer : c'est
//    précisément ce qu'on ne veut pas quand le fichier tombe entre de mauvaises
//    mains, parce qu'un attaquant en essaie alors des milliards. scrypt est
//    lent et gourmand en mémoire par construction. Un mot de passe d'admin
//    choisi par un développeur est un cas ; ceux de clientes, réutilisés d'un
//    site à l'autre, en sont un autre.
//
// 2. L'adresse doit être vérifiée avant la première connexion. Sans cela,
//    n'importe qui s'inscrivant avec l'adresse d'une autre verrait ses
//    commandes — son nom, son adresse de livraison, son téléphone, ce qu'elle
//    achète. Le rattachement des commandes se fait par l'adresse ; la
//    vérification est donc ce qui rend ce rattachement légitime.
//
// 3. Les réponses ne disent jamais si une adresse est connue. « Inscrivez-vous »
//    et « mot de passe oublié » répondent la même chose dans les deux cas :
//    autrement, le formulaire devient un moyen de savoir qui est cliente ici.

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, 'data');
const COMPTES_FILE = path.join(DATA_DIR, 'comptes.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions_clientes.json');

// Trois mois. Une cliente qui revient deux fois l'an ne doit pas se retrouver
// déconnectée à chaque visite ; c'est un compte de consultation, pas un accès
// à des moyens de paiement.
const DUREE_SESSION_MS = 90 * 24 * 60 * 60 * 1000;
const DUREE_VERIFICATION_MS = 24 * 60 * 60 * 1000;
const DUREE_REINITIALISATION_MS = 60 * 60 * 1000;

function lire(fichier) {
  try {
    const d = JSON.parse(fs.readFileSync(fichier, 'utf8'));
    return Array.isArray(d) ? d : [];
  } catch (_) {
    return [];
  }
}

// Écriture par fichier temporaire puis renommage : une coupure au milieu ne
// laisse pas un fichier de comptes tronqué.
function ecrire(fichier, data) {
  const tmp = fichier + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, fichier);
}

function normaliserEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// ── Mots de passe ─────────────────────────────────────────────────────────
const SCRYPT = { N: 16384, r: 8, p: 1, longueur: 64 };

function hacher(motDePasse, sel) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      String(motDePasse), sel, SCRYPT.longueur,
      { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: 64 * 1024 * 1024 },
      (err, cle) => (err ? reject(err) : resolve(cle.toString('hex')))
    );
  });
}

// Comparaison à temps constant : comparer deux chaînes avec === révèle, par la
// durée, combien de caractères concordent.
function memeEmpreinte(a, b) {
  const ba = Buffer.from(String(a), 'hex');
  const bb = Buffer.from(String(b), 'hex');
  if (ba.length !== bb.length || ba.length === 0) return false;
  return crypto.timingSafeEqual(ba, bb);
}

const jeton = () => crypto.randomBytes(32).toString('hex');

// ── Comptes ───────────────────────────────────────────────────────────────
function tousLesComptes() {
  return lire(COMPTES_FILE);
}

function compteParEmail(email) {
  const e = normaliserEmail(email);
  return tousLesComptes().find((c) => c.email === e) || null;
}

function enregistrer(compte) {
  const comptes = tousLesComptes();
  const i = comptes.findIndex((c) => c.id === compte.id);
  if (i === -1) comptes.push(compte);
  else comptes[i] = compte;
  ecrire(COMPTES_FILE, comptes);
  return compte;
}

// Crée un compte non vérifié, ou renvoie le jeton d'un compte existant qui ne
// l'est toujours pas — se réinscrire parce qu'on n'a pas vu le premier message
// est un geste banal, et il ne doit pas mener à une impasse.
async function creerCompte({ email, motDePasse, nom }) {
  const e = normaliserEmail(email);
  const existant = compteParEmail(e);
  if (existant && existant.verifie) return { deja: true, compte: existant };

  const sel = crypto.randomBytes(16).toString('hex');
  const empreinte = await hacher(motDePasse, sel);
  const compte = {
    id: existant ? existant.id : 'compte_' + crypto.randomUUID(),
    email: e,
    nom: String(nom || '').trim().slice(0, 120),
    telephone: existant ? existant.telephone || '' : '',
    adresse: existant ? existant.adresse || null : null,
    sel,
    empreinte,
    verifie: false,
    cree_le: existant ? existant.cree_le : new Date().toISOString(),
    verif_jeton: jeton(),
    verif_expire: Date.now() + DUREE_VERIFICATION_MS,
    reset_jeton: null,
    reset_expire: 0,
  };
  enregistrer(compte);
  return { deja: false, compte };
}

function verifierAdresse(jetonRecu) {
  const comptes = tousLesComptes();
  const compte = comptes.find((c) => c.verif_jeton && c.verif_jeton === jetonRecu);
  if (!compte) return null;
  if (compte.verif_expire < Date.now()) return { expire: true, compte };
  compte.verifie = true;
  compte.verif_jeton = null;
  compte.verif_expire = 0;
  enregistrer(compte);
  return { expire: false, compte };
}

// Vérifie un mot de passe. Toujours en temps comparable, que le compte existe
// ou non : sans cela, la rapidité de la réponse dit si l'adresse est connue.
async function motDePasseValide(email, motDePasse) {
  const compte = compteParEmail(email);
  const sel = compte ? compte.sel : 'sel-inexistant-pour-egaliser-le-temps';
  const empreinte = await hacher(motDePasse, sel);
  if (!compte) return null;
  if (!memeEmpreinte(empreinte, compte.empreinte)) return null;
  return compte;
}

async function changerMotDePasse(compte, motDePasse) {
  compte.sel = crypto.randomBytes(16).toString('hex');
  compte.empreinte = await hacher(motDePasse, compte.sel);
  compte.reset_jeton = null;
  compte.reset_expire = 0;
  // Changer de mot de passe vaut vérification : le lien reçu prouve l'accès à
  // la boîte, ce que la vérification demandait justement.
  compte.verifie = true;
  enregistrer(compte);
  // Toutes les sessions tombent : si le mot de passe a été changé parce qu'il
  // était compromis, laisser vivre les sessions ouvertes n'aurait aucun sens.
  fermerToutesLesSessions(compte.id);
  return compte;
}

function poserJetonReinitialisation(compte) {
  compte.reset_jeton = jeton();
  compte.reset_expire = Date.now() + DUREE_REINITIALISATION_MS;
  enregistrer(compte);
  return compte.reset_jeton;
}

function compteParJetonReinitialisation(jetonRecu) {
  const compte = tousLesComptes().find((c) => c.reset_jeton && c.reset_jeton === jetonRecu);
  if (!compte || compte.reset_expire < Date.now()) return null;
  return compte;
}

function majCoordonnees(compte, { nom, telephone, adresse }) {
  if (nom !== undefined) compte.nom = String(nom || '').trim().slice(0, 120);
  if (telephone !== undefined) compte.telephone = String(telephone || '').trim().slice(0, 40);
  if (adresse !== undefined) {
    const a = adresse || {};
    compte.adresse = (a.line1 || a.zip || a.city)
      ? {
          line1: String(a.line1 || '').trim().slice(0, 160),
          line2: String(a.line2 || '').trim().slice(0, 160),
          zip: String(a.zip || '').trim().slice(0, 20),
          city: String(a.city || '').trim().slice(0, 80),
          country: String(a.country || 'CH').trim().slice(0, 4),
        }
      : null;
  }
  enregistrer(compte);
  return compte;
}

// Efface un compte.
//
// Le compte, et lui seul. Les commandes restent : ce sont des pièces
// comptables, que la boutique doit conserver dix ans — sa propre politique de
// confidentialité le dit. Effacer le compte retire ce qui n'existait que pour
// la consultation : l'adresse, le mot de passe, le téléphone, l'adresse de
// livraison, et toutes les sessions ouvertes.
//
// La distinction n'est pas un détail juridique : promettre « tout est effacé »
// tout en gardant les commandes serait un mensonge, et l'interface doit dire
// exactement ce qui part et ce qui reste.
function supprimerCompte(compteId) {
  const comptes = tousLesComptes();
  const restants = comptes.filter((c) => c.id !== compteId);
  if (restants.length === comptes.length) return false;
  ecrire(COMPTES_FILE, restants);
  fermerToutesLesSessions(compteId);
  return true;
}

// ── Sessions ──────────────────────────────────────────────────────────────
function ouvrirSession(compteId) {
  const sessions = lire(SESSIONS_FILE).filter((s) => s.expire > Date.now());
  const t = jeton();
  sessions.push({ jeton: t, compteId, ouverte: Date.now(), expire: Date.now() + DUREE_SESSION_MS });
  ecrire(SESSIONS_FILE, sessions);
  return t;
}

function compteDeLaSession(jetonRecu) {
  if (!jetonRecu) return null;
  const s = lire(SESSIONS_FILE).find((x) => x.jeton === jetonRecu);
  if (!s || s.expire <= Date.now()) return null;
  const compte = tousLesComptes().find((c) => c.id === s.compteId);
  return compte && compte.verifie ? compte : null;
}

function fermerSession(jetonRecu) {
  ecrire(SESSIONS_FILE, lire(SESSIONS_FILE).filter((s) => s.jeton !== jetonRecu));
}

function fermerToutesLesSessions(compteId) {
  ecrire(SESSIONS_FILE, lire(SESSIONS_FILE).filter((s) => s.compteId !== compteId));
}

// ── Limitation des tentatives ─────────────────────────────────────────────
//
// En mémoire, et c'est assez : un redémarrage remet les compteurs à zéro, mais
// il faudrait le provoquer à chaque salve pour en tirer quelque chose. Le but
// est d'empêcher d'essayer dix mille mots de passe, pas de tenir un registre.
const tentatives = new Map();
const FENETRE_MS = 15 * 60 * 1000;
const MAX_TENTATIVES = 8;

function tropDeTentatives(cle) {
  const t = tentatives.get(cle);
  if (!t) return false;
  if (Date.now() - t.debut > FENETRE_MS) { tentatives.delete(cle); return false; }
  return t.n >= MAX_TENTATIVES;
}

function noterTentative(cle) {
  const t = tentatives.get(cle);
  if (!t || Date.now() - t.debut > FENETRE_MS) tentatives.set(cle, { n: 1, debut: Date.now() });
  else t.n += 1;
}

function oublierTentatives(cle) {
  tentatives.delete(cle);
}

// Ce qu'on renvoie au navigateur : jamais le sel ni l'empreinte, jamais les
// jetons. Une seule fonction, pour qu'aucune route ne puisse l'oublier.
function vueCliente(compte) {
  return {
    email: compte.email,
    nom: compte.nom || '',
    telephone: compte.telephone || '',
    adresse: compte.adresse || null,
    cree_le: compte.cree_le,
  };
}

module.exports = {
  COMPTES_FILE,
  normaliserEmail,
  creerCompte,
  compteParEmail,
  verifierAdresse,
  motDePasseValide,
  changerMotDePasse,
  poserJetonReinitialisation,
  compteParJetonReinitialisation,
  majCoordonnees,
  ouvrirSession,
  compteDeLaSession,
  fermerSession,
  supprimerCompte,
  vueCliente,
  tropDeTentatives,
  noterTentative,
  oublierTentatives,
};

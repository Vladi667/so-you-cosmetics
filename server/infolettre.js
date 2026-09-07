// L'infolettre, envoyée depuis la boutique.
//
// Un service tiers gérerait mieux les rebonds et la délivrabilité ; le choix a
// été fait de rester en interne, et ce fichier assume les conséquences que ce
// choix impose. Elles se résument à quatre :
//
// 1. UN MESSAGE PAR PERSONNE, jamais une copie cachée à trois cents adresses.
//    Non par élégance : le lien de désinscription doit être propre à chaque
//    destinataire, et il ne peut pas l'être dans un envoi groupé.
//
// 2. AU COMPTE-GOUTTES. Trois cents messages lâchés d'un coup, et le serveur
//    d'envoi vous ferme la porte — quand ce n'est pas le domaine qui se
//    retrouve sur une liste noire. Un message par seconde par défaut : cinq
//    minutes pour trois cents adresses, ce qui n'est rien pour un envoi qu'on
//    prépare depuis la veille.
//
// 3. REPRENABLE. Cinq minutes, c'est assez long pour qu'un redémarrage tombe
//    au milieu. Les adresses déjà servies sont écrites au fur et à mesure, si
//    bien qu'une reprise continue là où l'envoi s'est arrêté au lieu de tout
//    recommencer — personne ne reçoit deux fois la même infolettre.
//
// 4. HONNÊTE SUR LES ÉCHECS. sendMail() retombe sur un journal local quand le
//    SMTP refuse, et renvoie « succès » : parfait pour une confirmation de
//    commande, trompeur ici, où l'on annoncerait « 300 envoyés » alors que
//    trois cents ont échoué. On lit donc le drapeau « mock » et on compte
//    l'échec pour ce qu'il est.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const emailService = require('./email');
const db = require('./db');
const rebonds = require('./rebonds');

const FICHIER = path.join(__dirname, 'data', 'infolettres.json');

// Un message par seconde. Réglable par variable d'environnement le jour où
// l'hébergeur se montre plus ou moins tolérant.
const PAUSE_MS = Number(process.env.NEWSLETTER_PAUSE_MS) || 1000;

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

function enregistrer(lettre) {
  const liste = lire();
  const i = liste.findIndex((l) => l.id === lettre.id);
  if (i === -1) liste.unshift(lettre);
  else liste[i] = lettre;
  ecrire(liste);
  return lettre;
}

const parId = (id) => lire().find((l) => l.id === id) || null;

function creer({ sujet, html }) {
  return enregistrer({
    id: 'lettre_' + crypto.randomUUID(),
    sujet: String(sujet || '').trim().slice(0, 200),
    html: String(html || ''),
    etat: 'brouillon',
    cree_le: new Date().toISOString(),
    modifie_le: new Date().toISOString(),
    envoi: null,
  });
}

function modifier(id, { sujet, html }) {
  const lettre = parId(id);
  if (!lettre) return null;
  // Une lettre partie ne se réécrit pas : le texte enregistré doit rester
  // celui que les gens ont reçu.
  if (lettre.etat !== 'brouillon') return { verrouillee: true, lettre };
  if (sujet !== undefined) lettre.sujet = String(sujet || '').trim().slice(0, 200);
  if (html !== undefined) lettre.html = String(html || '');
  lettre.modifie_le = new Date().toISOString();
  return { verrouillee: false, lettre: enregistrer(lettre) };
}

function supprimer(id) {
  const lettre = parId(id);
  if (!lettre) return false;
  if (lettre.etat === 'envoi') return false;      // pas pendant qu'elle part
  ecrire(lire().filter((l) => l.id !== id));
  return true;
}

// La mise en page de l'envoi. Le pied de page n'est pas optionnel : le lien de
// désinscription est promis par la politique de confidentialité, et l'ajouter
// ici plutôt que de compter sur celle qui rédige est la seule façon qu'il n'y
// manque jamais.
function habiller({ sujet, html, lienDesabo, base }) {
  return `
    <div style="font-family:sans-serif;color:#3A332B;max-width:600px;margin:0 auto;padding:24px;background:#FDFBF7;">
      <p style="font-family:sans-serif;letter-spacing:.22em;text-transform:uppercase;font-size:13px;color:#3A332B;margin:0 0 4px;">So You Cosmetics</p>
      <p style="font-family:sans-serif;letter-spacing:.3em;text-transform:uppercase;font-size:9px;color:#B9A891;margin:0 0 24px;">Genève</p>
      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:26px;color:#3A332B;margin:0 0 20px;">${sujet}</h1>
      <div style="font-size:15px;line-height:1.7;color:#3A332B;">${html}</div>
      <div style="border-top:1px solid #DED3C4;margin-top:36px;padding-top:16px;font-size:12px;color:#6A6157;line-height:1.6;">
        <p style="margin:0 0 6px;">Boutique Soap Opera by So You Cosmetics — 3 av. Pictet-de-Rochemont, 1207 Genève</p>
        <p style="margin:0 0 10px;"><a href="${base}" style="color:#6A6157;">soyoucosmetics.com</a> · <a href="mailto:contact@soyoucosmetics.com" style="color:#6A6157;">contact@soyoucosmetics.com</a></p>
        <p style="margin:0;">Vous recevez ce message parce que vous vous êtes inscrite à notre infolettre.
          <a href="${lienDesabo}" style="color:#6A6157;">Me désinscrire</a>.</p>
      </div>
    </div>`;
}

// Les adresses inscrites, dédoublonnées. Le fichier mêle d'anciennes entrées
// en simple chaîne et des objets : les deux formes sont acceptées ici comme
// ailleurs.
async function destinataires() {
  const brut = await db.getNewsletterSubscribers();
  const vues = new Set();
  const liste = [];
  for (const n of brut || []) {
    const e = String((typeof n === 'string' ? n : (n && n.email)) || '').trim().toLowerCase();
    if (!e || vues.has(e)) continue;
    vues.add(e);
    // Une adresse écartée pour rebonds ne reçoit plus rien. Elle reste
    // inscrite — c'est peut-être une faute de frappe qu'elle corrigera — mais
    // continuer d'écrire à une boîte morte abîme la réputation de l'expéditeur,
    // et c'est à celles qui existent encore que ça coûte.
    if (rebonds.estEcartee(e)) continue;
    liste.push(e);
  }
  return liste;
}

// Un envoi en cours par lettre, et pas deux : sans ce verrou, un double clic
// sur « Envoyer » lancerait deux boucles sur la même liste.
const enCours = new Set();

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function envoyer(id, { base, essaiVers = null } = {}) {
  const lettre = parId(id);
  if (!lettre) return { erreur: 'Infolettre introuvable.' };
  if (!lettre.sujet.trim()) return { erreur: 'Donnez un objet à cette infolettre avant de l’envoyer.' };
  if (!String(lettre.html).replace(/<[^>]*>/g, '').trim()) {
    return { erreur: 'Cette infolettre est vide.' };
  }

  // Un essai : une seule adresse, rien d'enregistré, rien de verrouillé.
  if (essaiVers) {
    const r = await unEnvoi(essaiVers, lettre, base);
    return r.ok ? { essai: true, vers: essaiVers } : { erreur: 'L’essai n’est pas parti : ' + r.motif };
  }

  if (enCours.has(id)) return { erreur: 'Cette infolettre est déjà en cours d’envoi.' };
  if (lettre.etat === 'envoyee') return { erreur: 'Cette infolettre a déjà été envoyée.' };

  const adresses = await destinataires();
  if (adresses.length === 0) return { erreur: 'Aucune adresse inscrite.' };

  lettre.etat = 'envoi';
  lettre.envoi = lettre.envoi || { debut: new Date().toISOString(), fin: null, total: 0, faits: [], echecs: [] };
  lettre.envoi.debut = lettre.envoi.debut || new Date().toISOString();
  lettre.envoi.total = adresses.length;
  enregistrer(lettre);

  enCours.add(id);
  // On rend la main tout de suite : trois cents messages prennent cinq
  // minutes, et une requête HTTP qui attend cinq minutes expire.
  boucle(id, adresses, base).finally(() => enCours.delete(id));
  return { demarre: true, total: adresses.length, dejaFaits: lettre.envoi.faits.length };
}

async function unEnvoi(adresse, lettre, base) {
  try {
    const lienDesabo = `${base}/desabonnement?e=${encodeURIComponent(adresse)}&s=${db.signerEmailNewsletter(adresse)}`;
    const r = await emailService.sendMail({
      to: adresse,
      subject: lettre.sujet,
      html: habiller({ sujet: lettre.sujet, html: lettre.html, lienDesabo, base }),
    });
    // « mock » veut dire que le SMTP a refusé et que le message n'est parti
    // nulle part. En développement c'est le fonctionnement normal ; en
    // production, c'est un échec qu'il ne faut pas compter comme un succès.
    if (r && r.mock && process.env.SMTP_HOST) {
      const cause = r.echec || { message: 'SMTP indisponible' };
      return { ok: false, cause, motif: cause.message || 'SMTP indisponible' };
    }
    return { ok: true };
  } catch (err) {
    const cause = { message: err.message, code: err.responseCode || err.code };
    return { ok: false, cause, motif: err.message || 'erreur inconnue' };
  }
}

async function boucle(id, adresses, base) {
  // A-t-on réussi ne serait-ce qu'un envoi depuis le début ?
  //
  // C'est la question qui protège la liste. Un échec passager — un serveur
  // injoignable, un délai dépassé — ne dit rien de l'adresse tant qu'on n'a pas
  // la preuve que le tuyau fonctionne. Si RIEN n'est parti de tout l'envoi,
  // l'explication tient en un mot : c'est notre serveur, pas les trois cents
  // adresses qui auraient toutes disparu le même jour.
  //
  // Sans cette précaution, trois envois ratés d'affilée écartaient la liste
  // entière — le contrôle l'a montré, et c'est précisément le dégât qu'un
  // traitement naïf des rebonds provoque.
  //
  // Un refus DÉFINITIF, lui, compte toujours : un « adresse inconnue » désigne
  // cette adresse-là et reste vrai même si le reste de l'envoi échoue.
  let auMoinsUnSucces = false;

  for (const adresse of adresses) {
    const lettre = parId(id);
    if (!lettre || lettre.etat !== 'envoi') return;        // arrêtée entre-temps
    if (lettre.envoi.faits.includes(adresse)) continue;    // déjà servie

    const r = await unEnvoi(adresse, lettre, base);

    let verdict = null;
    if (r.ok) {
      auMoinsUnSucces = true;
      rebonds.noterSucces(adresse);
    } else {
      const definitif = rebonds.estDefinitif(r.cause);
      if (definitif || auMoinsUnSucces) {
        verdict = rebonds.noterEchec(adresse, r.cause, 'envoi');
      }
    }

    // On réécrit à CHAQUE message plutôt qu'à la fin : c'est ce qui permet à
    // un envoi interrompu de reprendre sans réexpédier ce qui est parti.
    const suite = parId(id);
    if (!suite) return;
    if (r.ok) suite.envoi.faits.push(adresse);
    else suite.envoi.echecs.push({
      adresse,
      motif: r.motif,
      ecartee: Boolean(verdict && verdict.ecartee),
      definitif: Boolean(verdict && verdict.definitif),
      // Un échec qu'on n'a pas retenu contre l'adresse : on le dit, sinon
      // l'écran laisserait croire à un oubli.
      nonImpute: !verdict && !r.ok,
      quand: new Date().toISOString(),
    });
    enregistrer(suite);

    await dormir(PAUSE_MS);
  }

  const finale = parId(id);
  if (finale && finale.etat === 'envoi') {
    finale.etat = 'envoyee';
    finale.envoi.fin = new Date().toISOString();
    enregistrer(finale);
  }
}

function arreter(id) {
  const lettre = parId(id);
  if (!lettre || lettre.etat !== 'envoi') return false;
  // La boucle relit l'état avant chaque message : il suffit de l'écrire.
  lettre.etat = 'interrompue';
  enregistrer(lettre);
  return true;
}

// Une lettre laissée en « envoi » par un redémarrage n'est pas en train de
// partir : plus aucune boucle ne tourne. On le dit, plutôt que d'afficher une
// progression figée que personne ne comprendrait.
function reveil() {
  const liste = lire();
  let touchees = 0;
  for (const l of liste) {
    if (l.etat === 'envoi') { l.etat = 'interrompue'; touchees += 1; }
  }
  if (touchees > 0) {
    ecrire(liste);
    console.log(`Infolettre : ${touchees} envoi(s) interrompu(s) par un redémarrage, à reprendre depuis l’administration.`);
  }
}

reveil();

module.exports = {
  lire,
  parId,
  creer,
  modifier,
  supprimer,
  envoyer,
  arreter,
  destinataires,
  habiller,
};

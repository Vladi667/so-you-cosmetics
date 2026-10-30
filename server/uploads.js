const fs = require('fs');
const path = require('path');

// Where admin-uploaded product images live on disk.
//
// Defaults to server/data/uploads, which survives a deploy that only replaces
// ./dist. If the host wipes the application directory on deploy (fresh
// container, rsync --delete, rebuild from git), set UPLOADS_DIR to a path on a
// persistent volume — otherwise every deploy silently deletes the shop's
// product photos while their URLs stay in the database, leaving broken images.
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'data', 'uploads');

function ensureUploadsDir() {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  return UPLOADS_DIR;
}

// Un fichier nommé par son contenu, et non par l'heure de son arrivée.
//
// Le nom portait `Date.now()` et quatre octets aléatoires : deux envois des
// mêmes octets produisaient donc deux fichiers distincts, et la galerie du
// produit affichait deux fois la même photo. C'est arrivé en production — la
// même image téléversée à 44 minutes d'intervalle sur « 'Absolute' — Gel Crème
// Visage », probablement parce que le premier envoi n'avait pas paru prendre.
//
// L'empreinte du contenu remplace l'horodatage : les mêmes octets retombent
// sur le même nom, et le second envoi n'écrit rien. Le préfixe lisible est
// conservé pour qu'on reconnaisse un fichier en le voyant, mais la recherche
// porte sur l'empreinte SEULE — la même image envoyée sous un autre nom est
// donc reconnue elle aussi.
const crypto = require('node:crypto');

function empreinteContenu(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

// Le fichier déjà stocké qui porte cette empreinte, s'il existe.
//
// Le dossier compte quelques dizaines d'entrées : un parcours suffit, et évite
// d'avoir à tenir un index qui pourrait diverger du disque. Les fichiers
// antérieurs à ce nommage ne correspondent simplement à rien — ils restent
// servis par leur URL d'origine.
function fichierExistant(empreinte, ext) {
  let noms;
  try {
    noms = fs.readdirSync(UPLOADS_DIR);
  } catch (_) {
    return null;
  }
  const suffixe = `-${empreinte}.${ext}`;
  return noms.find((n) => n.endsWith(suffixe)) || null;
}

module.exports = { UPLOADS_DIR, ensureUploadsDir, empreinteContenu, fichierExistant };

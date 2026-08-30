// Rapatrier les photos du catalogue, aujourd'hui hébergées chez Wix.
//
// Les 442 photos des 174 fiches pointent toutes vers static.wixstatic.com. Le
// site a beau ne plus tourner sur Wix, tout son catalogue en dépend encore : le
// jour où cet abonnement s'arrête, 174 fiches perdent leur image, leurs aperçus
// de partage deviennent vides, et le flux Merchant Center devient invalide —
// image_link y est obligatoire.
//
// Ce n'est pas une hypothèse lointaine : la boutique a précisément migré hors de
// Wix, et personne ne garde un abonnement dont il ne se sert plus.
//
// Ce que le script fait, pour chaque photo :
//
//   1. la télécharge chez Wix au plus grand gabarit que le site demande
//      (1600 px de large) — pas l'original, qui pèse 4,6 Mo et dont on n'a
//      aucun usage ;
//   2. en dérive les trois largeurs servies (400, 800, 1600) en JPEG, et les
//      mêmes en AVIF ;
//   3. réécrit l'adresse de la fiche vers /uploads/catalogue/….
//
// L'AVIF n'oblige à changer aucun composant : server/index.js le sert par
// négociation de contenu quand le navigateur l'accepte, exactement comme le
// faisait « enc_auto » chez Wix. On garde donc les deux gains d'hier — la bonne
// taille et le bon format — en cessant de dépendre d'un tiers.
//
// Usage :
//   node scripts/rapatrier-images.mjs              → simulation
//   node scripts/rapatrier-images.mjs --faire      → télécharge et réécrit
//   node scripts/rapatrier-images.mjs --faire --limite 5   → sur cinq fiches
//
// Idempotent : une photo déjà rapatriée est sautée. Le script peut donc être
// relancé après une coupure, ou quand elle ajoute des fiches depuis Wix.
//
// À lancer SUR L'HÔTE : il écrit dans server/data/uploads, qui est le volume
// persistant, et met à jour la base de production via db.updateProduct.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const execFileP = promisify(execFile);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const db = require(path.join(RACINE, 'server/db.js'));

const args = new Set(process.argv.slice(2));
const FAIRE = args.has('--faire');
const iLimite = process.argv.indexOf('--limite');
const LIMITE = iLimite > -1 ? Number(process.argv[iLimite + 1]) || 0 : 0;

// Les trois largeurs que le site demande réellement, définies dans
// src/services/products.js. Le rapport 4/5 est celui des trois cadres.
const LARGEURS = [400, 800, 1600];
const DOSSIER = path.join(RACINE, 'server/data/uploads/catalogue');

const c = {
  gras: (s) => `\x1b[1m${s}\x1b[0m`,
  vert: (s) => `\x1b[32m${s}\x1b[0m`,
  rouge: (s) => `\x1b[31m${s}\x1b[0m`,
  jaune: (s) => `\x1b[33m${s}\x1b[0m`,
  gris: (s) => `\x1b[90m${s}\x1b[0m`,
};

const estWix = (u) => /static\.wixstatic\.com/.test(String(u || ''));

// Un nom de fichier stable, dérivé de l'adresse d'origine.
//
// Dérivé et non séquentiel : relancer le script sur une photo déjà rapatriée
// doit retomber sur le même nom, sinon chaque passage créerait des doublons et
// invaliderait les adresses déjà servies.
function nomDeBase(url) {
  return crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16);
}

// L'adresse Wix au gabarit voulu. Le site sert du 4/5 ; demander autre chose
// ferait recadrer Wix et changerait ce qu'on voit aujourd'hui.
function urlWix(url, largeur) {
  const hauteur = Math.round((largeur * 5) / 4);
  return String(url).replace(/w_\d+,h_\d+/, `w_${largeur},h_${hauteur}`);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Trois tentatives, et une pause entre chaque photo.
//
// Une première version tirait les téléchargements les uns derrière les autres,
// sans réessai : deux photos sur quatre ont échoué dès l'essai, en « fetch
// failed ». Les mêmes adresses répondaient parfaitement une par une — c'était
// Wix qui refusait la cadence, pas les fichiers qui manquaient.
//
// Sur 442 photos, ce genre d'échec passager est certain. Et un catalogue à
// moitié rapatrié est pire que pas rapatrié du tout : la moitié des fiches
// dépendraient encore de Wix sans que rien ne le signale.
async function telecharger(url, destination, essais = 3) {
  let derniere;
  for (let essai = 1; essai <= essais; essai += 1) {
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
      const buffer = Buffer.from(await reponse.arrayBuffer());
      // Une réponse vide ou une page d'erreur déguisée en image : mieux vaut
      // échouer ici que d'écrire un fichier illisible et le découvrir en ligne.
      if (buffer.length < 1024) throw new Error(`réponse trop courte (${buffer.length} o)`);
      fs.writeFileSync(destination, buffer);
      return buffer.length;
    } catch (err) {
      derniere = err;
      // Attente croissante : une seconde, puis deux, puis quatre.
      if (essai < essais) await dormir(1000 * 2 ** (essai - 1));
    }
  }
  throw new Error(`${derniere.message} (après ${essais} essais)`);
}

async function convertir(source, destination, largeur, format) {
  const hauteur = Math.round((largeur * 5) / 4);
  const options = format === 'avif'
    ? ['-c:v', 'libaom-av1', '-crf', '32', '-cpu-used', '6', '-still-picture', '1']
    : ['-q:v', '6'];
  await execFileP('ffmpeg', [
    '-v', 'error', '-y', '-i', source,
    '-vf', `scale=${largeur}:${hauteur}:force_original_aspect_ratio=increase,crop=${largeur}:${hauteur}`,
    ...options, destination,
  ]);
  return fs.statSync(destination).size;
}

async function principal() {
  console.log(`\n${c.gras('Rapatriement des photos du catalogue')}`);

  const produits = await db.getProducts();
  const liste = Array.isArray(produits) ? produits : [];
  const aFaire = liste
    .filter((p) => (p.images || []).some(estWix))
    .slice(0, LIMITE || undefined);

  const photos = aFaire.reduce((n, p) => n + (p.images || []).filter(estWix).length, 0);
  console.log(`\n  fiches concernées : ${aFaire.length} / ${liste.length}`);
  console.log(`  photos à rapatrier : ${photos}`);
  console.log(`  destination        : ${path.relative(RACINE, DOSSIER)}`);
  console.log(`  variantes          : ${LARGEURS.join(', ')} px, en JPEG et AVIF`);

  if (!FAIRE) {
    console.log(`\n${c.jaune('Simulation.')} Rien n'a été téléchargé.`);
    console.log(`Pour lancer : ${c.gras('node scripts/rapatrier-images.mjs --faire')}\n`);
    return;
  }

  fs.mkdirSync(DOSSIER, { recursive: true });
  let rapatriees = 0;
  let sautees = 0;
  let echecs = 0;
  let octets = 0;

  for (const produit of aFaire) {
    const nouvelles = [];
    for (const image of produit.images || []) {
      if (!estWix(image)) { nouvelles.push(image); continue; }

      const base = nomDeBase(image);
      const temoin = path.join(DOSSIER, `${base}-1600.jpg`);
      if (fs.existsSync(temoin)) {
        nouvelles.push(`/uploads/catalogue/${base}-1600.jpg`);
        sautees += 1;
        continue;
      }

      try {
        const source = path.join(DOSSIER, `${base}-source.jpg`);
        octets += await telecharger(urlWix(image, 1600), source);
        for (const largeur of LARGEURS) {
          await convertir(source, path.join(DOSSIER, `${base}-${largeur}.jpg`), largeur, 'jpg');
          await convertir(source, path.join(DOSSIER, `${base}-${largeur}.avif`), largeur, 'avif');
        }
        fs.unlinkSync(source);
        // Une pause entre deux photos : on est invité chez Wix, pas chez nous.
        await dormir(250);
        nouvelles.push(`/uploads/catalogue/${base}-1600.jpg`);
        rapatriees += 1;
        process.stdout.write(`\r  ${rapatriees} rapatriées, ${sautees} déjà là, ${echecs} en échec   `);
      } catch (err) {
        // Une photo qui échoue garde son adresse Wix : mieux vaut une fiche qui
        // dépend encore d'un tiers qu'une fiche sans image du tout.
        console.error(`\n  ${c.rouge('✗')} ${produit.name?.slice(0, 40)} : ${err.message}`);
        nouvelles.push(image);
        echecs += 1;
      }
    }

    if (nouvelles.some((u, i) => u !== (produit.images || [])[i])) {
      await db.updateProduct(produit.id, { ...produit, images: nouvelles });
    }
  }

  console.log(`\n\n  ${c.vert('✓')} ${rapatriees} rapatriées, ${sautees} déjà présentes, ${echecs} en échec`);
  console.log(`  ${c.gris(`${(octets / 1048576).toFixed(0)} Mo téléchargés depuis Wix`)}`);
  if (echecs) {
    console.log(`  ${c.jaune('!')} les photos en échec gardent leur adresse Wix — relancer pour réessayer`);
  }
  console.log();
}

principal().catch((err) => {
  console.error(`\n${c.rouge('✗')} ${err.message}\n`);
  process.exit(1);
});

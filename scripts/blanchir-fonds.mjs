// Rendre leur fond aux photos qui étaient transparentes chez Wix.
//
// Signalé depuis un iPad : « certaines images de produits ne s'affichent pas et
// sont remplacées par un fond noir », l'eau de fleur d'oranger par exemple. Ce
// n'était pas l'iPad. Les fichiers eux-mêmes sont noirs, pour tout le monde.
//
// Ces photos étaient des PNG détourés. Wix les affichait sur le fond de sa page,
// en WebP avec leur transparence. Mais rapatrier-images.mjs les a demandées en
// « file.jpg », et un JPEG n'a pas de couche alpha : Wix l'aplatit sur du noir.
// Le flacon blanc d'oranger se retrouvait dans un cadre noir, au milieu d'une
// grille de cartes ivoire. 42 photos sur 168 dans ce cas, sur 25 fiches.
//
// Ce que fait le script, pour chaque photo du catalogue en ligne :
//
//   1. retrouve son adresse Wix d'origine — le nom local est l'empreinte de
//      cette adresse, et les copies du catalogue dans le dépôt les gardent ;
//   2. si l'original est un PNG avec transparence, le télécharge en entier ;
//   3. le pose sur l'ivoire des cartes (--color-ivory) et en redérive les six
//      fichiers servis, aux mêmes noms : 400, 800, 1600, en JPEG et en AVIF.
//
// Les mêmes noms, donc aucune fiche à réécrire. Les navigateurs qui ont déjà
// la version noire en cache — servie « immutable » pour un an — reçoivent la
// nouvelle par le paramètre ?v= qu'ajoute imageUrl (src/services/products.js).
//
// Usage :
//   node scripts/blanchir-fonds.mjs             → prépare dans scratch/fonds/
//   node scripts/blanchir-fonds.mjs --envoyer   → et les dépose sur l'hôte
//
// L'envoi garde chaque fichier remplacé à côté, suffixé « .noir » : le retour
// arrière est un renommage. Rien n'est redémarré, rien n'est réécrit dans la
// base — ce sont des fichiers statiques.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import SftpClient from 'ssh2-sftp-client';
import 'dotenv/config';

const execFileP = promisify(execFile);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENVOYER = process.argv.includes('--envoyer');
const SITE = process.env.DEPLOY_URL || 'https://soyoucosmetics.com';
const SORTIE = path.join(RACINE, 'scratch/fonds');
const LARGEURS = [400, 800, 1600];
// L'ivoire des cartes. Un blanc pur se verrait comme un rectangle plus clair
// dans le cadre ; celui-ci s'y fond.
const FOND = '0xFDFBF7';

const c = {
  gras: (s) => `\x1b[1m${s}\x1b[0m`,
  vert: (s) => `\x1b[32m${s}\x1b[0m`,
  rouge: (s) => `\x1b[31m${s}\x1b[0m`,
  gris: (s) => `\x1b[90m${s}\x1b[0m`,
};

// La même empreinte que rapatrier-images.mjs : c'est elle qui relie un fichier
// local à son adresse Wix.
const empreinte = (url) => crypto.createHash('sha1').update(String(url)).digest('hex').slice(0, 16);

function adressesWix() {
  const table = new Map();
  for (const f of ['server/products.json', 'src/data/products.json', 'catalog_products.csv']) {
    const texte = fs.readFileSync(path.join(RACINE, f), 'utf8');
    for (const m of texte.matchAll(/https:\/\/static\.wixstatic\.com\/[^"\s]+?\/file\.[a-z]+/g)) {
      table.set(empreinte(m[0]), m[0]);
    }
  }
  return table;
}

// L'original, sans le segment de transformation : « …~mv2.png/v1/fill/…/file.jpg »
// devient « …~mv2.png ». C'est le seul qui garde la transparence.
const original = (url) => url.replace(/\/v1\/.*$/, '');

async function aDeLaTransparence(fichier) {
  const { stdout } = await execFileP('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=pix_fmt', '-of', 'csv=p=0', fichier,
  ]);
  // pal8 peut porter une transparence ou non ; le poser sur l'ivoire ne change
  // rien à un PNG opaque, donc dans le doute on le traite.
  return /^(rgba|bgra|argb|abgr|ya8|ya16|rgba64|pal8)/.test(stdout.trim());
}

async function convertir(source, destination, largeur) {
  const hauteur = Math.round((largeur * 5) / 4);
  const codec = destination.endsWith('.avif')
    ? ['-c:v', 'libaom-av1', '-crf', '32', '-cpu-used', '6', '-still-picture', '1', '-pix_fmt', 'yuv444p']
    : ['-q:v', '6', '-pix_fmt', 'yuvj444p'];
  // Le même cadrage que Wix en « fill » : couvrir le 4/5, puis rogner au centre.
  await execFileP('ffmpeg', [
    '-v', 'error', '-y', '-i', source,
    '-filter_complex',
    `color=c=${FOND}:s=${largeur}x${hauteur}[fond];` +
    `[0:v]scale=${largeur}:${hauteur}:force_original_aspect_ratio=increase,crop=${largeur}:${hauteur}[photo];` +
    '[fond][photo]overlay=format=auto:shortest=1',
    '-frames:v', '1', ...codec, destination,
  ]);
}

async function preparer() {
  const reponse = await fetch(`${SITE}/api/products`);
  if (!reponse.ok) throw new Error(`catalogue en ligne : HTTP ${reponse.status}`);
  const produits = await reponse.json();
  const wix = adressesWix();

  const aTraiter = new Map(); // empreinte → adresse Wix
  for (const p of produits) {
    for (const image of p.images || []) {
      const m = String(image).match(/^\/uploads\/catalogue\/([a-f0-9]+)-\d+\.jpg$/);
      const adresse = m && wix.get(m[1]);
      if (adresse && /\.png\//i.test(adresse)) aTraiter.set(m[1], adresse);
    }
  }
  console.log(`\n${c.gras('Photos issues d’un PNG Wix')} : ${aTraiter.size}`);

  fs.mkdirSync(SORTIE, { recursive: true });
  const faites = [];
  for (const [base, adresse] of aTraiter) {
    const source = path.join(SORTIE, `${base}-source.png`);
    if (!fs.existsSync(source)) {
      const r = await fetch(original(adresse));
      if (!r.ok) { console.log(`  ${c.rouge('✗')} ${base} : HTTP ${r.status}`); continue; }
      fs.writeFileSync(source, Buffer.from(await r.arrayBuffer()));
    }
    // Un PNG opaque est une photo comme une autre : son JPEG est juste.
    if (!(await aDeLaTransparence(source))) { console.log(`  ${c.gris('·')} ${base} opaque, inchangée`); continue; }
    for (const largeur of LARGEURS) {
      for (const ext of ['jpg', 'avif']) {
        await convertir(source, path.join(SORTIE, `${base}-${largeur}.${ext}`), largeur);
      }
    }
    faites.push(base);
    console.log(`  ${c.vert('✓')} ${base}`);
  }
  console.log(`\n  ${faites.length} photos refaites sur fond ivoire, dans ${path.relative(RACINE, SORTIE)}`);
  return faites;
}

async function envoyer(bases) {
  const racine = process.env.DEPLOY_REMOTE_ROOT;
  if (!process.env.DEPLOY_HOST || !racine) throw new Error('DEPLOY_HOST et DEPLOY_REMOTE_ROOT sont requis (.env)');
  const dossier = `${racine}/server/data/uploads/catalogue`;
  const sftp = new SftpClient();
  await sftp.connect({
    host: process.env.DEPLOY_HOST,
    port: Number(process.env.DEPLOY_PORT || 22),
    username: process.env.DEPLOY_USER,
    ...(process.env.DEPLOY_KEY
      ? { privateKey: fs.readFileSync(process.env.DEPLOY_KEY) }
      : { password: process.env.DEPLOY_PASSWORD }),
  });
  try {
    let n = 0;
    for (const base of bases) {
      for (const largeur of LARGEURS) {
        for (const ext of ['jpg', 'avif']) {
          const nom = `${base}-${largeur}.${ext}`;
          const cible = `${dossier}/${nom}`;
          // On ne remplace que ce qui existe : un fichier absent voudrait dire
          // qu'on se trompe de dossier, pas qu'il faut le créer.
          if (!(await sftp.exists(cible))) throw new Error(`absent sur l'hôte : ${cible}`);
          if (!(await sftp.exists(`${cible}.noir`))) await sftp.rename(cible, `${cible}.noir`);
          await sftp.put(path.join(SORTIE, nom), cible);
          n += 1;
        }
      }
    }
    console.log(`\n  ${c.vert('✓')} ${n} fichiers déposés ; les anciens sont gardés en « .noir »`);
  } finally {
    await sftp.end();
  }
}

const bases = await preparer();
if (ENVOYER && bases.length) await envoyer(bases);
else if (!ENVOYER) console.log(`\nRien n'a été envoyé. Pour déposer : ${c.gras('node scripts/blanchir-fonds.mjs --envoyer')}\n`);

// Le déploiement, par SFTP, vers une boutique qui encaisse.
//
// Aucun script n'existait : ssh2-sftp-client était déclaré dans package.json et
// importé nulle part, et le déploiement se faisait donc à la main. Ce fichier
// écrit la procédure une fois pour toutes, avec les garde-fous qu'un transfert
// manuel n'a pas.
//
// Ce qu'il refuse de faire, et c'est l'essentiel :
//
//   server/data/ n'est jamais touché. Il contient les commandes réelles, le mot
//   de passe de l'administration, les horaires, les tarifs postaux, le compteur
//   de factures, ses textes réécrits, ses articles, et ses photos téléversées.
//   Les copies locales de ces fichiers sont des coquilles vides de deux octets :
//   les envoyer effacerait la boutique. Ce n'est pas un réglage, c'est une
//   interdiction.
//
// Il ne redémarre pas Node non plus : le SFTP transfère des fichiers, il
// n'exécute rien. Le redémarrage reste manuel, et le script le rappelle.
//
// Usage :
//   node scripts/deployer.mjs                 → simulation, rien n'est envoyé
//   node scripts/deployer.mjs --pour-de-vrai  → transfère
//   node scripts/deployer.mjs --verifier      → contrôle le site en ligne
//
// Identifiants : par variables d'environnement uniquement, jamais dans le code
// ni dans le dépôt. Un fichier .env à la racine convient (il est déjà ignoré
// par git) :
//
//   DEPLOY_HOST=…            l'hôte SFTP
//   DEPLOY_USER=…            l'utilisateur
//   DEPLOY_PASSWORD=…        le mot de passe, OU
//   DEPLOY_KEY=…             le chemin d'une clé privée
//   DEPLOY_REMOTE_ROOT=…     la racine du site sur l'hôte
//   DEPLOY_PORT=22           facultatif
//   DEPLOY_URL=https://…     facultatif, pour --verifier

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import SftpClient from 'ssh2-sftp-client';
import 'dotenv/config';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = new Set(process.argv.slice(2));
const POUR_DE_VRAI = args.has('--pour-de-vrai');
const AVEC_CATALOGUE = args.has('--avec-catalogue');
const VERIFIER_SEUL = args.has('--verifier');

const c = {
  gras: (s) => `\x1b[1m${s}\x1b[0m`,
  vert: (s) => `\x1b[32m${s}\x1b[0m`,
  rouge: (s) => `\x1b[31m${s}\x1b[0m`,
  jaune: (s) => `\x1b[33m${s}\x1b[0m`,
  gris: (s) => `\x1b[90m${s}\x1b[0m`,
};

function mourir(message) {
  console.error(`\n${c.rouge('✗')} ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Ce qui part, et ce qui ne part jamais
// ---------------------------------------------------------------------------

// Les fichiers du serveur : le code, et lui seul.
//
// Énumérés un par un plutôt qu'exclus par motif. Une liste blanche se trompe en
// oubliant d'envoyer un fichier — on s'en aperçoit tout de suite. Une liste
// noire se trompe en envoyant ce qu'elle aurait dû retenir, et là on s'en
// aperçoit quand les commandes ont disparu.
const FICHIERS_SERVEUR = [
  'index.js',
  'db.js',
  'routes.js',
  'seo.js',
  'email.js',
  'imap.js',
  'uploads.js',
  'package.json',
];

// Le catalogue de repli. Exclu par défaut : si l'hôte tourne sans MySQL, c'est
// ce fichier qu'écrit l'administration, et la version du dépôt a divergé de la
// sienne. L'écraser lui ferait perdre ses modifications de fiches.
const CATALOGUE = 'products.json';

// Interdits absolus. Vérifiés à l'envoi, en plus des listes ci-dessus : deux
// verrous valent mieux qu'un quand l'erreur est irréversible.
const JAMAIS = [/(^|[\\/])data([\\/]|$)/, /node_modules/, /(^|[\\/])\.env/, /(^|[\\/])\.git([\\/]|$)/];

function interdit(chemin) {
  return JAMAIS.some((r) => r.test(chemin));
}

// ---------------------------------------------------------------------------
// Contrôles préalables
// ---------------------------------------------------------------------------

function lireConfig() {
  const cfg = {
    host: process.env.DEPLOY_HOST,
    port: Number(process.env.DEPLOY_PORT || 22),
    username: process.env.DEPLOY_USER,
    password: process.env.DEPLOY_PASSWORD,
    cleChemin: process.env.DEPLOY_KEY,
    racineDistante: process.env.DEPLOY_REMOTE_ROOT,
  };
  const manquants = [];
  if (!cfg.host) manquants.push('DEPLOY_HOST');
  if (!cfg.username) manquants.push('DEPLOY_USER');
  if (!cfg.password && !cfg.cleChemin) manquants.push('DEPLOY_PASSWORD ou DEPLOY_KEY');
  if (!cfg.racineDistante) manquants.push('DEPLOY_REMOTE_ROOT');
  if (manquants.length) {
    mourir(
      `Identifiants manquants : ${manquants.join(', ')}.\n` +
      `  Les poser dans un .env à la racine, ou dans l'environnement.\n` +
      `  Ils ne doivent jamais entrer dans le dépôt : .env y est déjà ignoré.`
    );
  }

  // Git Bash réécrit les chemins absolus avant que Node ne les voie.
  //
  // « DEPLOY_REMOTE_ROOT=/sites/soyou » arrive en
  // « C:/Program Files/Git/sites/soyou » : MSYS croit rendre service en
  // traduisant un chemin Unix vers Windows, et il n'a aucun moyen de savoir que
  // celui-ci désigne une machine distante. Relevé en essayant ce script.
  //
  // Sans ce contrôle, le script créerait sur le serveur une arborescence portant
  // ce nom-là, en signalant une réussite. Le site, lui, ne changerait pas.
  if (/^[A-Za-z]:[\\/]/.test(cfg.racineDistante) || cfg.racineDistante.includes('\\')) {
    mourir(
      `DEPLOY_REMOTE_ROOT ressemble à un chemin Windows : ${cfg.racineDistante}\n` +
      `  C'est presque sûrement Git Bash qui a traduit un chemin distant.\n` +
      `  Le relancer en désactivant la conversion :\n` +
      `      MSYS_NO_PATHCONV=1 node scripts/deployer.mjs …\n` +
      `  ou poser la valeur dans .env, que le shell ne touche pas.`
    );
  }
  if (!cfg.racineDistante.startsWith('/')) {
    mourir(`DEPLOY_REMOTE_ROOT doit être un chemin absolu sur l'hôte : ${cfg.racineDistante}`);
  }
  return cfg;
}

// La construction doit être plus récente que les sources, sinon on enverrait
// une version qu'on n'a pas relue.
function verifierConstruction() {
  const dist = path.join(RACINE, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    mourir('dist/index.html est absent. Lancer « npm run build » d’abord.');
  }

  // Le moteur de rendu serveur, produit par la même commande.
  //
  // Son absence ne casse rien — le serveur retombe sur la coquille — mais elle
  // annule silencieusement le rendu du corps des pages, et personne ne s'en
  // apercevrait avant de regarder le HTML reçu par un robot. Mieux vaut refuser
  // de partir que livrer une version qui paraît complète et ne l'est pas.
  if (!fs.existsSync(path.join(RACINE, 'dist-ssr', 'entry-server.js'))) {
    mourir(
      'dist-ssr/entry-server.js est absent.\n' +
      '  Le site fonctionnerait, mais servirait une coquille vide aux robots\n' +
      '  qui n’exécutent pas JavaScript — ce que le rendu serveur corrige.\n' +
      '  Lancer « npm run build », qui produit les deux.'
    );
  }

  const dateDist = fs.statSync(path.join(dist, 'index.html')).mtimeMs;

  let plusRecent = 0;
  let coupable = '';
  const parcourir = (dossier) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(complet);
      else if (/\.(jsx?|css|json)$/.test(e.name)) {
        const m = fs.statSync(complet).mtimeMs;
        if (m > plusRecent) { plusRecent = m; coupable = path.relative(RACINE, complet); }
      }
    }
  };
  parcourir(path.join(RACINE, 'src'));

  if (plusRecent > dateDist) {
    mourir(
      `La construction est plus ancienne que les sources.\n` +
      `  ${coupable} a changé depuis le dernier « npm run build ».\n` +
      `  Reconstruire, sinon vous enverriez une version que vous n'avez pas vue.`
    );
  }
}

function etatDuDepot() {
  try {
    const sale = execSync('git status --porcelain', { cwd: RACINE }).toString().trim();
    const commit = execSync('git rev-parse --short HEAD', { cwd: RACINE }).toString().trim();
    const branche = execSync('git rev-parse --abbrev-ref HEAD', { cwd: RACINE }).toString().trim();
    return { sale, commit, branche };
  } catch {
    return { sale: '', commit: '?', branche: '?' };
  }
}

// ---------------------------------------------------------------------------
// L'inventaire de ce qui sera transféré
// ---------------------------------------------------------------------------

function listerDossier(nom) {
  const base = path.join(RACINE, nom);
  const fichiers = [];
  const parcourir = (dossier) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(complet);
      else fichiers.push(complet);
    }
  };
  parcourir(base);
  return fichiers.map((f) => ({
    local: f,
    relatif: path.relative(base, f).split(path.sep).join('/'),
    taille: fs.statSync(f).size,
  }));
}

function listerServeur() {
  const base = path.join(RACINE, 'server');
  const noms = [...FICHIERS_SERVEUR, ...(AVEC_CATALOGUE ? [CATALOGUE] : [])];
  return noms
    .map((n) => ({ local: path.join(base, n), relatif: n }))
    .filter((f) => {
      if (!fs.existsSync(f.local)) {
        console.warn(`  ${c.jaune('!')} ${f.relatif} est absent localement, ignoré`);
        return false;
      }
      return true;
    })
    .map((f) => ({ ...f, taille: fs.statSync(f.local).size }));
}

const ko = (o) => `${(o / 1024).toFixed(0)} Ko`;

// ---------------------------------------------------------------------------
// Le transfert
// ---------------------------------------------------------------------------

async function deployer(cfg, dist, ssr, serveur) {
  const sftp = new SftpClient();
  const connexion = {
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    ...(cfg.cleChemin
      ? { privateKey: fs.readFileSync(cfg.cleChemin) }
      : { password: cfg.password }),
  };

  console.log(`\n${c.gras('Connexion')} à ${cfg.host}:${cfg.port}…`);
  await sftp.connect(connexion);
  console.log(`  ${c.vert('✓')} connecté`);

  const racine = cfg.racineDistante.replace(/\/+$/, '');
  const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  // Les deux dossiers construits, traités ensemble.
  //
  // dist-ssr/ porte le moteur de rendu du serveur ; dist/ porte le paquet que
  // le navigateur exécute ensuite. Les deux sortent de la même construction et
  // DOIVENT rester appariés : un moteur d'une version rendant un balisage que
  // le paquet d'une autre version hydrate, c'est une divergence d'hydratation
  // sur chaque page, pour tout visiteur pris dans la fenêtre.
  //
  // On envoie donc les deux dans des dossiers provisoires, puis on bascule les
  // deux à la suite. SFTP ne permet pas d'être atomique sur deux dossiers ;
  // deux renommages consécutifs réduisent la fenêtre à quelques millisecondes,
  // au lieu de la durée d'un transfert de 14 Mo.
  const dossiers = [
    { nom: 'dist', fichiers: dist },
    { nom: 'dist-ssr', fichiers: ssr },
  ].map((d) => ({
    ...d,
    provisoire: `${racine}/${d.nom}.nouveau-${horodatage}`,
    precedent: `${racine}/${d.nom}.precedent-${horodatage}`,
  }));

  try {
    // Chaque dossier passe par un provisoire.
    //
    // Envoyer les fichiers un par un par-dessus les anciens laisserait, pendant
    // toute la durée du transfert, un site qui mélange l'ancien index.html et
    // les nouveaux fichiers — donc des adresses d'empreintes qui n'existent pas
    // encore. Ici la fenêtre se réduit à un renommage, et l'ancien dossier reste
    // à côté : le retour arrière est immédiat.
    for (const d of dossiers) {
      console.log(`\n${c.gras(d.nom + '/')} → ${path.basename(d.provisoire)}`);
      await sftp.mkdir(d.provisoire, true);
      let n = 0;
      for (const f of d.fichiers) {
        if (interdit(f.relatif)) mourir(`refus : ${f.relatif} correspond à une interdiction`);
        const cible = `${d.provisoire}/${f.relatif}`;
        const dossier = cible.slice(0, cible.lastIndexOf('/'));
        if (!(await sftp.exists(dossier))) await sftp.mkdir(dossier, true);
        await sftp.put(f.local, cible);
        n += 1;
        process.stdout.write(`\r  ${n}/${d.fichiers.length} fichiers`);
      }
      console.log(`\r  ${c.vert('✓')} ${n} fichiers envoyés          `);
    }

    // Les deux bascules, à la suite et sans rien entre elles.
    console.log(`\n${c.gras('Bascule')}`);
    for (const d of dossiers) {
      if (await sftp.exists(`${racine}/${d.nom}`)) {
        await sftp.rename(`${racine}/${d.nom}`, d.precedent);
      }
      await sftp.rename(d.provisoire, `${racine}/${d.nom}`);
      console.log(`  ${c.vert('✓')} ${d.nom} en place`);
    }

    // Le serveur : petits fichiers de code, posés directement. Node ne relira
    // rien avant son redémarrage, il n'y a donc pas d'état intermédiaire visible.
    console.log(`\n${c.gras('server/')}`);
    for (const f of serveur) {
      if (interdit(f.relatif)) mourir(`refus : ${f.relatif} correspond à une interdiction`);
      await sftp.put(f.local, `${racine}/server/${f.relatif}`);
      console.log(`  ${c.vert('✓')} ${f.relatif} ${c.gris(`(${ko(f.taille)})`)}`);
    }

    // Le retour arrière porte sur les deux dossiers, et sur les deux ensemble :
    // remettre l'ancien dist sans l'ancien dist-ssr laisserait un moteur de
    // rendu et un paquet client de versions différentes, donc une divergence
    // d'hydratation sur chaque page.
    console.log(`\n  ${c.gris(
      `Retour arrière : renommer dist.precedent-${horodatage} et ` +
      `dist-ssr.precedent-${horodatage} en dist et dist-ssr — les deux ensemble.`
    )}`);
  } finally {
    await sftp.end();
  }
}

// ---------------------------------------------------------------------------
// Le contrôle du site en ligne
// ---------------------------------------------------------------------------

async function verifier(base) {
  console.log(`\n${c.gras('Contrôle de')} ${base}\n`);
  // Chaque contrôle regarde le corps, pas seulement le code.
  //
  // Une première version se contentait du statut : « /en/about répond 200 »
  // passait au vert sur le site d'aujourd'hui, où le fourre-tout sert la
  // coquille pour n'importe quelle adresse. Un contrôle qui réussit pour la
  // mauvaise raison est pire que pas de contrôle du tout — il endort.
  const controles = [
    ['/', 200, /text\/html/, null, 'l’accueil répond'],
    ['/sitemap.xml', 200, /xml/, (t) => t.includes('<urlset'), 'le plan du site est un vrai XML'],
    ['/robots.txt', 200, /text\/plain/, (t) => /Sitemap:/i.test(t), 'robots.txt déclare le plan du site'],
    ['/en/about', 200, /text\/html/, (t) => /<html[^>]*lang="en"/.test(t), 'la page anglaise s’annonce en anglais'],
    ['/de/workshops', 200, /text\/html/, (t) => /<html[^>]*lang="de"/.test(t), 'la page allemande s’annonce en allemand'],
    ['/', 200, null, (t) => /hreflang="x-default"/.test(t), 'hreflang est posé'],
    ['/', 200, null, (t) => /application\/ld\+json/.test(t), 'les données structurées sont présentes'],
    ['/nimportequoi-du-tout', 404, null, null, 'une adresse inconnue répond 404'],
  ];

  let echecs = 0;
  for (const [chemin, codeAttendu, typeAttendu, corpsAttendu, libelle] of controles) {
    try {
      const r = await fetch(base.replace(/\/+$/, '') + chemin, { redirect: 'follow' });
      const type = r.headers.get('content-type') || '';
      let bon = r.status === codeAttendu && (!typeAttendu || typeAttendu.test(type));
      let detail = `${r.status} ${type.split(';')[0]}`;
      if (bon && corpsAttendu) {
        const corps = await r.text();
        if (!corpsAttendu(corps)) { bon = false; detail += ', mais le contenu attendu manque'; }
      }
      console.log(`  ${bon ? c.vert('✓') : c.rouge('✗')} ${libelle} ${c.gris(`— ${detail}`)}`);
      if (!bon) echecs += 1;
    } catch (err) {
      console.log(`  ${c.rouge('✗')} ${libelle} ${c.gris(`— ${err.message}`)}`);
      echecs += 1;
    }
  }

  // La compression et le cache : les deux relevés qui ont motivé leur correction.
  try {
    const accueil = await fetch(base);
    const html = await accueil.text();
    const bundle = (html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/) || [])[0];
    if (bundle) {
      const r = await fetch(base.replace(/\/+$/, '') + bundle, {
        headers: { 'Accept-Encoding': 'gzip, br' },
      });
      const enc = r.headers.get('content-encoding');
      const cache = r.headers.get('cache-control') || '';
      // Deux constats distincts, donc deux échecs distincts : les compter pour
      // un seul faisait dire « 3 » là où l'écran en montrait quatre.
      console.log(`  ${enc ? c.vert('✓') : c.rouge('✗')} le paquet est compressé ${c.gris(`— ${enc || 'aucun content-encoding'}`)}`);
      if (!enc) echecs += 1;
      console.log(`  ${/immutable/.test(cache) ? c.vert('✓') : c.rouge('✗')} les fichiers empreintés sont mis en cache ${c.gris(`— ${cache || 'aucun'}`)}`);
      if (!/immutable/.test(cache)) echecs += 1;
    }
  } catch { /* le contrôle principal a déjà signalé l'indisponibilité */ }

  console.log(echecs === 0
    ? `\n${c.vert('Tout est en place.')}\n`
    : `\n${c.rouge(`${echecs} contrôle(s) en échec.`)}\n`);
  return echecs;
}

// ---------------------------------------------------------------------------

async function principal() {
  const urlSite = process.env.DEPLOY_URL || 'https://soyoucosmetics.com';

  if (VERIFIER_SEUL) {
    process.exit((await verifier(urlSite)) === 0 ? 0 : 1);
  }

  console.log(`\n${c.gras('Déploiement — So You Cosmetics')}`);

  verifierConstruction();
  const cfg = lireConfig();
  const depot = etatDuDepot();
  const dist = listerDossier('dist');
  const ssr = listerDossier('dist-ssr');
  const serveur = listerServeur();
  const poids = dist.reduce((t, f) => t + f.taille, 0);
  const poidsSsr = ssr.reduce((t, f) => t + f.taille, 0);

  console.log(`\n  branche      ${depot.branche} ${c.gris(`(${depot.commit})`)}`);
  console.log(`  destination  ${cfg.username}@${cfg.host}:${cfg.racineDistante}`);
  console.log(`  dist/        ${dist.length} fichiers, ${ko(poids)}`);
  console.log(`  dist-ssr/    ${ssr.length} fichiers, ${ko(poidsSsr)} ${c.gris('— le moteur de rendu serveur')}`);
  console.log(`  server/      ${serveur.length} fichiers de code`);
  console.log(`  ${c.gras('jamais')}       server/data/ ${c.gris('— commandes, réglages, photos, mot de passe')}`);
  if (!AVEC_CATALOGUE) {
    console.log(`  ${c.gras('exclu')}        server/products.json ${c.gris('— --avec-catalogue pour l’inclure')}`);
  }

  if (depot.sale) {
    console.log(`\n  ${c.jaune('!')} des modifications ne sont pas validées :`);
    console.log(depot.sale.split('\n').slice(0, 8).map((l) => `      ${l}`).join('\n'));
    console.log(`      ${c.gris('ce qui part n’est donc pas exactement ' + depot.commit)}`);
  }

  if (!POUR_DE_VRAI) {
    console.log(`\n${c.jaune('Simulation.')} Rien n'a été envoyé.`);
    console.log(`Pour transférer : ${c.gras('node scripts/deployer.mjs --pour-de-vrai')}\n`);
    return;
  }

  await deployer(cfg, dist, ssr, serveur);

  console.log(`\n${c.gras('Il reste deux gestes, que le SFTP ne peut pas faire :')}`);
  console.log(`  1. ${c.gras('npm install --prefix server')} sur l'hôte`);
  console.log(`     ${c.gris('sans cela, « compression » manque et le paquet repart entier')}`);
  console.log(`  2. redémarrer Node`);
  console.log(`     ${c.gris('le panneau de l’hébergeur échoue parfois en silence — vérifier ensuite')}`);
  console.log(`\nPuis : ${c.gras('node scripts/deployer.mjs --verifier')}\n`);
}

principal().catch((err) => mourir(err && err.message ? err.message : String(err)));

// Vérifie que chaque texte appelé par le site existe dans les trois langues.
//
// Une clef de traduction absente ne casse rien : elle ne lève pas d'erreur, ne
// fait pas échouer le build, et n'apparaît pas dans la console. Elle s'écrit
// simplement en clair au milieu de la page — « footer.links.personnalisation »
// noir sur blanc dans le pied de page, offert au visiteur. C'est ainsi que le
// défaut a été trouvé la première fois : sur une capture d'écran, à l'œil nu.
//
// Ce contrôle le rend mécanique. Il couvre les appels littéraux t('...') et
// résout les six gabarits dynamiques depuis leur source réelle, de sorte
// qu'ajouter une entrée au pied de page ou une formule de personnalisation
// est automatiquement vérifié sans toucher à ce fichier.
//
//   npm run verifier:traductions
//
// Sort en code 1 s'il manque quoi que ce soit, pour pouvoir garder un build.
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGUES = ['fr', 'en', 'de'];

const traductions = (await import(pathToFileURL(path.join(RACINE, 'src/i18n/translations.js')).href)).default;

// Le même parcours que le resolve() du site : chemin pointé, index de tableau.
// Un tableau ou un objet compte comme présent : le code en parcourt certains
// (privacy.sections) et lit les propriétés d'autres (contact.noteHolidays.q).
function existe(langue, chemin) {
  let noeud = traductions[langue];
  for (const part of String(chemin).split('.')) {
    if (noeud === null || noeud === undefined) return false;
    noeud = noeud[part];
  }
  return noeud !== undefined && noeud !== null;
}

const lire = (rel) => fs.readFileSync(path.join(RACINE, rel), 'utf8');

// --- 1 · les appels littéraux ----------------------------------------------
const fichiers = [];
(function parcourir(dossier) {
  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) parcourir(complet);
    else if (/\.jsx?$/.test(entree.name)) fichiers.push(complet);
  }
})(path.join(RACINE, 'src'));

const appels = [];
for (const fichier of fichiers) {
  const relatif = path.relative(RACINE, fichier).replace(/\\/g, '/');
  lire(relatif).split('\n').forEach((ligne, i) => {
    for (const m of ligne.matchAll(/\bt\(\s*'([^']+)'/g)) {
      appels.push({ clef: m[1], ou: `${relatif}:${i + 1}` });
    }
  });
}

// --- 2 · les gabarits dynamiques, résolus depuis leur déclaration -----------
// Chaque entrée dit où lire les valeurs possibles, pour que l'ajout d'une
// rubrique soit couvert sans modifier ce fichier.
const GABARITS = [
  {
    // t(`footer.links.${item.key}`) — celui qui avait cassé.
    fichier: 'src/components/Footer.jsx',
    motif: /key:\s*'([^']+)'/g,
    prefixe: 'footer.links.',
  },
  {
    // t(`catalog.${LIBELLES_TRANCHES[tranche.id]}`)
    fichier: 'src/components/Catalog.jsx',
    bloc: /LIBELLES_TRANCHES\s*=\s*\{([^}]*)\}/,
    motif: /:\s*'([^']+)'/g,
    prefixe: 'catalog.',
  },
  {
    // t(`catalog.badges.${ribbon}`) — seuls les préréglés sont traduits ;
    // tout autre ruban est du texte libre affiché tel quel.
    fichier: 'src/components/ProductBadge.jsx',
    bloc: /BADGE_PRESETS\s*=\s*\[([^\]]*)\]/,
    motif: /'([^']+)'/g,
    prefixe: 'catalog.badges.',
  },
  {
    // t(`personnalisation.${f.titre|corps|condition}`)
    fichier: 'src/pages/PersonnalisationPage.jsx',
    motif: /(?:titre|corps|condition):\s*'([^']+)'/g,
    prefixe: 'personnalisation.',
  },
  {
    // t(NAV_LABELS[item])
    fichier: 'src/components/Navbar.jsx',
    bloc: /NAV_LABELS\s*=\s*\{([^}]*)\}/,
    motif: /:\s*'([^']+)'/g,
    prefixe: '',
  },
];

for (const g of GABARITS) {
  let source = lire(g.fichier);
  if (g.bloc) {
    const m = source.match(g.bloc);
    if (!m) {
      console.error(`Bloc introuvable dans ${g.fichier} — ce contrôle est devenu aveugle.`);
      process.exitCode = 1;
      continue;
    }
    source = m[1];
  }
  for (const m of source.matchAll(g.motif)) {
    appels.push({ clef: g.prefixe + m[1], ou: `${g.fichier} (gabarit)` });
  }
}

// --- 3 · verdict ------------------------------------------------------------
const distinctes = new Map();
for (const a of appels) if (!distinctes.has(a.clef)) distinctes.set(a.clef, a.ou);

const manquantes = [];
for (const [clef, ou] of distinctes) {
  const absentes = LANGUES.filter((l) => !existe(l, clef));
  if (absentes.length) manquantes.push({ clef, ou, absentes });
}

console.log(`${appels.length} appels · ${distinctes.size} clefs distinctes · ${LANGUES.join('/')}`);

if (manquantes.length === 0) {
  console.log('Aucune clef manquante : rien ne peut s’afficher en clair.');
} else {
  console.log('');
  console.log(`${manquantes.length} CLEF(S) MANQUANTE(S) — elles s’afficheront en clair :`);
  for (const { clef, ou, absentes } of manquantes) {
    console.log(`  ${clef}`);
    console.log(`     absente en ${absentes.join(', ')} · ${ou}`);
  }
  process.exitCode = 1;
}

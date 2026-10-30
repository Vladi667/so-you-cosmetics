// Fond les trois fiches « Absolute » en une seule, à trois contenances.
//
// Trois fiches, deux mêmes photos, la même description au caractère près : rien
// ne les distingue que le prix et le format. La cliente qui tombe sur le 15 ml
// n'apprend jamais que le 50 existe, et chaque correction de texte doit être
// faite trois fois.
//
// Ce que le script fait, dans cet ordre :
//   1. il vérifie que les trois fiches sont bien celles attendues — nom, prix,
//      contenance. Une seule qui ne correspond pas, et il s'arrête sans écrire ;
//   2. il pose les trois contenances sur la fiche 15 ml, qui survit ;
//   3. il lui confie les identifiants des deux autres, pour que leurs adresses
//      redirigent au lieu de tomber en 404 ;
//   4. il retire les deux autres, et nettoie les « produits liés » qui les
//      citaient — un lien vers une fiche disparue ne mène nulle part.
//
// Sans --faire, il n'écrit rien.

const fs = require('fs');
const path = require('path');

const CHEMIN = process.env.CATALOGUE
  || '/srv/customer/sites/soyoucosmetics.com/server/products.json';
const FAIRE = process.argv.includes('--faire');

// Ce qu'on s'attend à trouver. Le script refuse d'écrire si la réalité diffère :
// les prix ont pu changer depuis, et fusionner sur une hypothèse fausse
// facturerait le mauvais montant.
const ATTENDU = [
  { fin: '5e04df6f', libelle: '15 ml', prix: 33.5, survit: true },
  { fin: 'c09cef8f', libelle: '30 ml', prix: 56.5, survit: false },
  { fin: '8d6c5964', libelle: '50 ml', prix: 82.5, survit: false },
];

const NOM_FUSIONNE = "'Absolute' - Gel Crème Visage à l'extrait de Centella Asiatica";

const data = JSON.parse(fs.readFileSync(CHEMIN, 'utf8'));
const produits = data.products;
console.log('Catalogue : ' + CHEMIN + '  (' + produits.length + ' fiches)\n');

const trouvees = [];
let refus = 0;
for (const a of ATTENDU) {
  const p = produits.find((x) => String(x.id).endsWith(a.fin));
  if (!p) { console.log('  ✗ introuvable : ' + a.fin); refus++; continue; }
  const okPrix = Math.abs(Number(p.price) - a.prix) < 0.001;
  const okNom = /Absolute/i.test(p.name) && p.name.includes(a.libelle);
  console.log('  ' + (okPrix && okNom ? '✓' : '✗') + ' ' + a.fin + ' — ' + p.name);
  console.log('      prix ' + p.price + (okPrix ? '' : ' ATTENDU ' + a.prix)
    + ' | contenance ' + (p.contenance || '—')
    + ' | ' + (p.images || []).length + ' photo(s)');
  if (!okPrix || !okNom) refus++;
  trouvees.push({ ...a, produit: p });
}

if (refus > 0) {
  console.log('\n  ' + refus + ' fiche(s) ne correspondent pas. Rien n\'a été écrit.');
  process.exit(1);
}

const survivante = trouvees.find((t) => t.survit).produit;
const absorbees = trouvees.filter((t) => !t.survit).map((t) => t.produit);

// Les contenances, du moins cher au plus cher — l'ordre de la barre, et celui
// qui décide du prix affiché sur la grille.
const variantes = trouvees
  .slice()
  .sort((a, b) => a.prix - b.prix)
  .map((t) => ({
    id: t.libelle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
    libelle: t.libelle,
    prix: Number(t.produit.price),
    // Aucune des 180 fiches ne porte de poids aujourd'hui : la règle des 2 kg
    // reste donc neutre ici, exactement comme avant la fusion. Le jour où elle
    // les donne, il suffit de les saisir dans l'admin.
    poids: t.produit.poids || null,
  }));

console.log('\n  Fiche conservée : ' + survivante.id);
console.log('  Nom             : « ' + survivante.name + ' »');
console.log('               →    « ' + NOM_FUSIONNE + ' »');
console.log('  Contenances     : ' + variantes.map((v) => v.libelle + ' ' + v.prix.toFixed(2)).join('  |  '));
console.log('  Prix de fiche   : ' + survivante.price + ' → ' + Math.min(...variantes.map((v) => v.prix)).toFixed(2));
console.log('  Absorbe         : ' + absorbees.map((p) => p.id.slice(-8)).join(', '));

// Les fiches liées qui citaient les deux disparues doivent pointer vers la
// survivante — et ne pas la citer deux fois.
const idsAbsorbes = absorbees.map((p) => p.id);
const relies = produits.filter((p) => (p.related || []).some((r) => idsAbsorbes.includes(r)));
console.log('  Liens à recoudre: ' + relies.length + ' fiche(s)');
for (const p of relies) console.log('      ' + p.name);

if (!FAIRE) {
  console.log('\n  SIMULATION — rien écrit. Relancer avec --faire.');
  process.exit(0);
}

const sauvegarde = CHEMIN + '.avant-fusion-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
fs.copyFileSync(CHEMIN, sauvegarde);
console.log('\n  Sauvegarde : ' + path.basename(sauvegarde));

survivante.name = NOM_FUSIONNE;
survivante.variantes = variantes;
survivante.price = Math.min(...variantes.map((v) => v.prix));
// Sur la grille, la carte annonce les trois formats d'un coup : sans cela, elle
// afficherait « 15 ml » sous un produit qui en propose trois.
survivante.contenance = variantes.map((v) => v.libelle.replace(/\s*ml$/, '')).join(' · ') + ' ml';
survivante.anciensIds = idsAbsorbes;

for (const p of relies) {
  const remplaces = (p.related || []).map((r) => (idsAbsorbes.includes(r) ? survivante.id : r));
  p.related = [...new Set(remplaces)];
}

data.products = produits.filter((p) => !idsAbsorbes.includes(p.id));

fs.writeFileSync(CHEMIN, JSON.stringify(data, null, 2));
console.log('  Écrit. ' + data.products.length + ' fiches (' + (produits.length - data.products.length) + ' de moins).');
console.log('\n  Il reste à redémarrer Node : le catalogue est tenu en mémoire.');

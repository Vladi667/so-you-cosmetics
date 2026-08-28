// Comparer deux textes comme un lecteur les compare, pas comme des octets.
//
// Quelqu'un qui cherche tape ce que son clavier produit, pas ce qui a été
// saisi dans la fiche produit. Les deux diffèrent plus souvent qu'on ne croit :
//
//   · les accents — « bebe » doit trouver « bébé » ;
//   · la ligature — « coeur » doit trouver « cœur », et « coup de cœur » est
//     justement le marquage des produits mis en avant ;
//   · l'apostrophe — un clavier tape la droite ('), mais Word, Pages et Google
//     Docs la corrigent silencieusement en courbe (’) au collage. Un nom de
//     produit collé depuis un document devenait alors introuvable pour tout le
//     monde, sans que rien ne le signale.
//
// Ces trois-là étaient traitées inégalement : la recherche du catalogue ignorait
// la ligature que l'autre normalisateur gérait, et aucune des deux ne voyait
// l'apostrophe. Une seule fonction, deux appelants, plus de dérive possible.
//
// Élargir la comparaison ne peut qu'augmenter le nombre de correspondances :
// deux textes qui se trouvaient continuent de se trouver.
export function normaliserTexte(valeur) {
  return (valeur || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/œ/g, 'oe')                      // œ
    .replace(/æ/g, 'ae')                      // æ
    .replace(/[‘’‛`´]/g, "'") // ‘ ’ ‛ ` ´ → '
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export default normaliserTexte;

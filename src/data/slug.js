// L'adresse lisible d'une fiche produit.
//
// Les identifiants viennent de l'import Wix et n'ont aucun sens pour un
// lecteur :
//
//     /product/product_16748cd3-85de-d7d0-c7ee-676bda3a72ce
//
// Ce n'est pas un facteur de classement majeur, mais c'est ce qu'on lit dans un
// résultat de recherche, dans la barre d'adresse, et dans le message où on
// envoie le lien à quelqu'un. Une adresse qui dit ce qu'elle contient se clique
// et se partage ; une suite hexadécimale, non. C'est aussi le texte que
// reprennent les liens entrants quand personne ne prend la peine d'écrire une
// ancre.
//
//     /product/eau-d-aloe-vera-bio-16748cd3
//
// Le moment est le bon : rien n'est encore indexé. Le faire plus tard coûterait
// des redirections et l'autorité déjà accumulée sur les anciennes adresses.
//
// Le suffixe n'est pas décoratif. Cinq produits sur 177 portent un nom qui se
// réduit au même slug — « Savon olive, coco, ricin, palme RSPO - Senteur X » et
// ses variantes. Huit caractères d'identifiant suffisent à les distinguer tous
// (vérifié sur le catalogue entier), et c'est aussi ce qui permet de retrouver
// la fiche sans consulter le catalogue.

const LONGUEUR_SUFFIXE = 8;

// Les huit caractères qui identifient une fiche, tirés de son identifiant.
export function empreinte(id) {
  return String(id || '')
    .replace(/^product_/, '')
    .replace(/-/g, '')
    .slice(0, LONGUEUR_SUFFIXE)
    .toLowerCase();
}

function slugifier(texte) {
  return String(texte || '')
    // Décompose les accents pour les retirer : « é » devient « e » plutôt que
    // de disparaître, ce qui garderait « bb » pour « bébé ».
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    // Assez long pour rester lisible, assez court pour ne pas faire une adresse
    // qui déborde de la barre.
    .slice(0, 60)
    .replace(/-+$/, '');
}

export function slugProduit(produit) {
  if (!produit || !produit.id) return '';
  const nom = slugifier(produit.name);
  const emp = empreinte(produit.id);
  return nom ? `${nom}-${emp}` : emp;
}

export function cheminProduit(produit) {
  return `/product/${slugProduit(produit)}`;
}

// Retrouve une fiche depuis ce que porte l'adresse.
//
// Accepte les deux formes, et c'est délibéré : les anciennes adresses — celles
// déjà envoyées par message, mises en favori, ou déposées au plan du site hier
// — doivent continuer de répondre. Le serveur les redirige ensuite vers la
// forme lisible, pour qu'une seule version soit indexée.
export function trouverProduit(parametre, produits) {
  if (!parametre || !Array.isArray(produits)) return null;
  const brut = String(parametre);

  // L'identifiant complet, tel qu'il était.
  const direct = produits.find((p) => p.id === brut);
  if (direct) return direct;

  // Sinon, les huit caractères de fin.
  const emp = brut.slice(-LONGUEUR_SUFFIXE).toLowerCase();
  return produits.find((p) => empreinte(p.id) === emp) || null;
}

// Vrai si l'adresse demandée n'est pas la forme canonique de cette fiche.
// C'est ce qui déclenche la redirection permanente côté serveur.
export function estAncienneAdresse(parametre, produit) {
  return Boolean(produit) && String(parametre) !== slugProduit(produit);
}

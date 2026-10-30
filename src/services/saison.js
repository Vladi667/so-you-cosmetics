// Quelle saison le site porte aujourd'hui.
//
// La valeur vient des réglages de la boutique, que le serveur pose dans la page
// avant de rendre — comme le catalogue et les horaires. C'est ce qui évite le
// clignotement : sans cela le site s'afficherait nu, puis se couvrirait de neige
// une fraction de seconde plus tard.
//
// Le paramètre « ?saison= » sert à prévisualiser sans rien enregistrer : c'est
// ce que l'aperçu de l'administration utilisera pour montrer les quatre
// habillages avant qu'elle en choisisse un.

export const SAISONS = ['aucune', 'hiver', 'printemps', 'ete', 'automne', 'noel'];

export function saisonCourante() {
  // Une seule source : ce que le serveur a posé dans la page. Il a déjà tenu
  // compte du « ?saison= » d'aperçu, donc le navigateur n'a rien à recalculer —
  // et les deux rendus coïncident, ce que l'hydratation exige.
  const reglages = globalThis.__SHOP__;
  const choisie = reglages && reglages.saison;
  return SAISONS.includes(choisie) ? choisie : 'aucune';
}

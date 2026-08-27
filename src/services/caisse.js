// Ce qui a déjà été tapé à la caisse, gardé d'une visite au panier à l'autre.
//
// Le défaut qu'elle a signalé : depuis le panier, elle est retournée à la
// boutique ajouter un produit — et en revenant, son nom et son adresse e-mail
// avaient disparu. Le formulaire vivait dans l'état du composant, et le tiroir
// se démonte en se fermant.
//
// C'est le genre de perte qui fait abandonner un panier : personne ne retape
// une adresse de livraison une seconde fois pour le plaisir. Et le geste qui
// la déclenche — aller chercher un article de plus — est exactement celui
// qu'une boutique veut encourager.
//
// Ce qui n'est PAS gardé : l'acceptation des conditions générales. Une case
// déjà cochée en revenant n'est pas une acceptation, et c'est le seul bouton
// du site qui déclenche un paiement. Elle se recoche à chaque commande.
const CLE = 'soyou.checkout.v1';

const VIDE = {
  name: '',
  email: '',
  adresse: { line1: '', line2: '', zip: '', city: '', country: 'CH' },
};

// localStorage jette dans une fenêtre privée ou quand les données de site sont
// bloquées : on rend un formulaire vierge plutôt que de casser la caisse.
export function lireCaisse() {
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return { ...VIDE, adresse: { ...VIDE.adresse } };
    const lu = JSON.parse(brut);
    return {
      name: typeof lu.name === 'string' ? lu.name : '',
      email: typeof lu.email === 'string' ? lu.email : '',
      adresse: { ...VIDE.adresse, ...(lu.adresse && typeof lu.adresse === 'object' ? lu.adresse : {}) },
    };
  } catch {
    return { ...VIDE, adresse: { ...VIDE.adresse } };
  }
}

export function ecrireCaisse(valeurs) {
  try {
    localStorage.setItem(CLE, JSON.stringify({
      name: valeurs.name || '',
      email: valeurs.email || '',
      adresse: valeurs.adresse || VIDE.adresse,
    }));
  } catch {
    // Rien à faire : le formulaire fonctionne, il ne sera simplement pas gardé.
  }
}

// Après une commande passée, on n'a plus de raison de garder ces données dans
// le navigateur — la commande, elle, est enregistrée côté serveur.
export function oublierCaisse() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    /* sans conséquence */
  }
}

// La boutique, écrite une fois : l'adresse, le téléphone, et le lien qui y mène.
//
// Ils vivaient en clair dans la page contact, la fiche produit et le pied de
// page. Maintenant qu'ils apparaissent aussi sur l'accueil et dans le panier,
// un déménagement ou un nouveau numéro ne doit se corriger qu'ici.

export const ADRESSE_RUE = '3 av. Pictet-de-Rochemont';
export const ADRESSE_VILLE = '1207 Genève';
export const TELEPHONE = '022 556 69 92';
export const TELEPHONE_LIEN = '+41225566992';

// L'itinéraire vers la FICHE Google de la boutique plutôt que vers une simple
// adresse : Maps ouvre alors ses horaires, ses photos et ses 14 avis, ce qui
// achève de convaincre de faire le déplacement.
export const LIEN_ITINERAIRE =
  'https://www.google.com/maps/dir/?api=1&destination='
  + encodeURIComponent('Soap Opera by So You Natural Cosmetics, 3 Avenue Pictet-de-Rochemont, 1207 Genève');

export const LIEN_CARTE =
  'https://www.google.com/maps/search/?api=1&query='
  + encodeURIComponent(`${ADRESSE_RUE}, ${ADRESSE_VILLE}`);

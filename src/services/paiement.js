// Ce que la boutique propose pour payer : les moyens que SumUp renvoie, et
// TWINT quand Payrexx est réglé. Lu par la rangée de logos et par le panier.

// Une seule requête par visite, partagée entre les deux.
let enCours = null;
export const chargerMoyens = () => {
  if (!enCours) {
    enCours = fetch('/api/paiement/moyens')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d) => ({ methodes: Array.isArray(d.methodes) ? d.methodes : [], twint: d.twint === true }))
      .catch(() => ({ methodes: [], twint: false }));
  }
  return enCours;
};


import React from 'react';
import LegalLayout from '../components/LegalLayout';

// NOTE: Placeholder copy — replace each section body with the final legal text.
const TermsPage = () => (
  <LegalLayout
    title="Conditions Générales"
    lastUpdated="—"
    intro="Les présentes conditions générales de vente régissent l'utilisation de ce site et les achats effectués auprès de SoYou Cosmetics, Genève. (Texte provisoire — à remplacer par vos conditions définitives.)"
    sections={[
      { heading: "1. Champ d'application", body: ["Texte à compléter : décrivez le champ d'application de vos conditions générales de vente."] },
      { heading: '2. Commandes', body: ['Texte à compléter : modalités de commande, confirmation et disponibilité des produits.'] },
      { heading: '3. Prix et paiement', body: ["Texte à compléter : prix indiqués en CHF, taxes applicables et moyens de paiement acceptés."] },
      { heading: '4. Livraison', body: ["Texte à compléter : zones, délais et frais de livraison. Livraison offerte dès CHF 100.- d'achat, expédition sous 2 à 4 jours ouvrés."] },
      { heading: '5. Droit de rétractation et retours', body: ['Texte à compléter : conditions de retour et de remboursement.'] },
      { heading: '6. Responsabilité', body: ['Texte à compléter : limitations de responsabilité.'] },
      { heading: '7. Droit applicable et for', body: ['Texte à compléter : droit suisse applicable et for juridique compétent.'] },
    ]}
  />
);

export default TermsPage;

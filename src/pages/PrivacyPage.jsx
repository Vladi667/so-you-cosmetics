import React from 'react';
import LegalLayout from '../components/LegalLayout';

// NOTE: Placeholder copy — replace each section body with the final privacy policy text.
const PrivacyPage = () => (
  <LegalLayout
    title="Politique de Confidentialité"
    lastUpdated="—"
    intro="SoYou Cosmetics accorde une grande importance à la protection de vos données personnelles. Cette politique explique quelles données nous collectons et comment elles sont utilisées. (Texte provisoire — à remplacer par votre politique définitive.)"
    sections={[
      { heading: '1. Données collectées', body: ['Texte à compléter : types de données collectées (nom, e-mail, adresse de livraison, etc.).'] },
      { heading: '2. Utilisation des données', body: ['Texte à compléter : finalités du traitement (traitement des commandes, communication, newsletter).'] },
      { heading: '3. Partage des données', body: ['Texte à compléter : prestataires tiers (paiement, livraison) et conditions de partage.'] },
      { heading: '4. Cookies', body: ['Texte à compléter : utilisation des cookies et options de gestion.'] },
      { heading: '5. Conservation et sécurité', body: ['Texte à compléter : durée de conservation et mesures de sécurité.'] },
      { heading: '6. Vos droits', body: ["Texte à compléter : droit d'accès, de rectification et de suppression de vos données."] },
    ]}
  />
);

export default PrivacyPage;

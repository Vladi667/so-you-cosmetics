import React from 'react';
import LegalLayout from '../components/LegalLayout';

const PrivacyPage = () => (
  <LegalLayout
    title="Politique de Confidentialité"
    lastUpdated="Mai 2026"
    intro="SoYou Cosmetics accorde une grande importance à la protection de votre sphère privée. La présente politique explique quelles données personnelles nous collectons, dans quel but et comment elles sont protégées, conformément à la Loi fédérale sur la protection des données (nLPD)."
    sections={[
      {
        heading: "1. Responsable du traitement",
        body: [
          "Boutique Soap Opera by SoYou Cosmetics, 3 ave. Pictet-De-Rochemont, 1207 Genève, Suisse.",
          "Pour toute question relative à vos données : contact@soyou.ch — 022 556 69 92.",
        ],
      },
      {
        heading: "2. Données que nous collectons",
        body: [
          "Nous collectons uniquement les données nécessaires à nos services :",
          [
            "Identité et coordonnées : nom, adresse e-mail, adresse de livraison, numéro de téléphone.",
            "Données de commande : produits commandés, montant et historique d'achat.",
            "Réservations d'ateliers : nom, e-mail et date choisie.",
            "Newsletter : votre adresse e-mail, si vous vous y inscrivez.",
            "Messages : le contenu des formulaires de contact que vous nous envoyez.",
          ],
          "Les données de paiement (carte bancaire) sont traitées directement par notre prestataire SumUp et ne sont jamais stockées sur nos serveurs.",
        ],
      },
      {
        heading: "3. Finalités du traitement",
        body: [
          "Vos données sont utilisées pour :",
          [
            "Traiter, préparer et livrer vos commandes et réservations.",
            "Vous contacter au sujet de votre commande ou de votre demande.",
            "Vous envoyer notre newsletter, lorsque vous y avez consenti.",
            "Respecter nos obligations légales et comptables.",
          ],
        ],
      },
      {
        heading: "4. Bases légales",
        body: [
          "Selon les cas, le traitement repose sur l'exécution du contrat (commandes et ateliers), sur votre consentement (newsletter), sur nos obligations légales, ainsi que sur notre intérêt légitime à gérer la relation client.",
        ],
      },
      {
        heading: "5. Destinataires des données",
        body: [
          "Vos données ne sont jamais vendues. Elles ne sont transmises qu'aux prestataires strictement nécessaires à l'exécution du service :",
          [
            "Prestataire de paiement : SumUp.",
            "Transporteurs (par exemple La Poste Suisse) pour la livraison de vos commandes.",
            "Hébergeur et service de messagerie (Infomaniak, en Suisse).",
          ],
        ],
      },
      {
        heading: "6. Hébergement et transferts",
        body: [
          "Nos données sont hébergées en Suisse. Certains prestataires (notamment de paiement) peuvent traiter des données à l'étranger ; nous veillons dans ce cas à ce que des garanties adéquates assurent un niveau de protection approprié.",
        ],
      },
      {
        heading: "7. Cookies et services tiers",
        body: [
          "Le site utilise des cookies et technologies similaires strictement nécessaires à son fonctionnement (par exemple le panier et la session). Certains services tiers intégrés peuvent déposer leurs propres cookies, notamment Google Maps (localisation de la boutique) et SumUp (paiement). Vous pouvez configurer votre navigateur pour refuser tout ou partie des cookies.",
        ],
      },
      {
        heading: "8. Durée de conservation",
        body: [
          "Nous conservons vos données aussi longtemps que nécessaire aux finalités décrites et dans le respect des délais légaux, notamment l'obligation de conservation des pièces commerciales pendant 10 ans. Les adresses inscrites à la newsletter sont conservées jusqu'à votre désinscription.",
        ],
      },
      {
        heading: "9. Sécurité",
        body: [
          "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées (connexion sécurisée HTTPS, accès restreint aux données) afin de protéger vos informations contre tout accès, perte ou utilisation non autorisés.",
        ],
      },
      {
        heading: "10. Vos droits",
        body: [
          "Conformément à la nLPD, vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition concernant vos données personnelles. Vous pouvez exercer ces droits à tout moment en écrivant à contact@soyou.ch.",
          "Vous avez également le droit de vous adresser au Préposé fédéral à la protection des données et à la transparence (PFPDT).",
        ],
      },
      {
        heading: "11. Newsletter",
        body: [
          "Chaque newsletter contient un lien de désinscription. Vous pouvez aussi demander votre retrait à tout moment par e-mail à contact@soyou.ch.",
        ],
      },
      {
        heading: "12. Modifications",
        body: [
          "La présente politique peut être mise à jour. La version applicable est celle publiée sur cette page.",
        ],
      },
    ]}
  />
);

export default PrivacyPage;

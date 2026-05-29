import React from 'react';
import LegalLayout from '../components/LegalLayout';

const TermsPage = () => (
  <LegalLayout
    title="Conditions Générales de Vente"
    lastUpdated="Mai 2026"
    intro="Les présentes conditions générales de vente (CGV) régissent la vente des produits et des prestations (ateliers) proposés par SoYou Cosmetics, en ligne sur soyoucosmetics.com et en boutique à Genève. Toute commande implique l'acceptation pleine et entière des présentes CGV."
    sections={[
      {
        heading: "1. Identité du vendeur",
        body: [
          "Boutique Soap Opera by SoYou Cosmetics",
          "3 ave. Pictet-De-Rochemont, 1207 Genève, Suisse",
          "Téléphone : 022 556 69 92 — E-mail : contact@soyou.ch",
          "Cosmétiques naturels faits main à Genève.",
        ],
      },
      {
        heading: "2. Produits",
        body: [
          "Nos produits sont des cosmétiques artisanaux fabriqués à la main à Genève. Les photographies et descriptions sont fournies à titre indicatif ; de légères variations de teinte, de parfum ou d'aspect sont inhérentes à la fabrication artisanale et ne constituent pas un défaut.",
          "Nos produits sont destinés à un usage cosmétique externe. Nous vous invitons à lire attentivement la liste des ingrédients en cas d'allergie ou de sensibilité particulière.",
        ],
      },
      {
        heading: "3. Prix",
        body: [
          "Les prix sont indiqués en francs suisses (CHF), toutes taxes éventuelles comprises. Ils peuvent être modifiés à tout moment ; le prix applicable est celui en vigueur au moment de la validation de la commande.",
          "Les frais de livraison éventuels sont indiqués avant la validation de la commande.",
        ],
      },
      {
        heading: "4. Commandes",
        body: [
          "La commande est validée après confirmation du panier et du paiement. Un récapitulatif vous est adressé par e-mail.",
          "SoYou Cosmetics se réserve le droit de refuser ou d'annuler toute commande en cas de rupture de stock, d'erreur manifeste de prix ou de litige antérieur avec le client.",
        ],
      },
      {
        heading: "5. Paiement",
        body: [
          "Le paiement s'effectue en ligne par carte bancaire via notre prestataire de paiement sécurisé SumUp. Les données de votre carte sont traitées directement par le prestataire et ne sont jamais conservées par SoYou Cosmetics.",
          "La commande est traitée après confirmation du paiement.",
        ],
      },
      {
        heading: "6. Livraison et retrait en boutique",
        body: [
          "Nous livrons en Suisse. La livraison est offerte dès CHF 100.- d'achat. Les commandes sont généralement expédiées sous 2 à 4 jours ouvrés, hors jours fériés et périodes de vacances.",
          "Le retrait gratuit en boutique est possible au 3 ave. Pictet-De-Rochemont, 1207 Genève, aux horaires d'ouverture. Les délais de livraison sont donnés à titre indicatif et un éventuel retard ne saurait donner lieu à annulation ou indemnité.",
        ],
      },
      {
        heading: "7. Retours et échanges",
        body: [
          "Conformément au droit suisse, les achats à distance ne bénéficient pas d'un droit de rétractation légal. Par geste commercial, un produit non ouvert et en parfait état peut être retourné dans un délai de 14 jours suivant sa réception, après accord préalable de notre part ; les frais de retour sont à la charge du client.",
          "Pour des raisons d'hygiène, les cosmétiques descellés, ouverts ou utilisés ne peuvent être ni repris ni échangés.",
        ],
      },
      {
        heading: "8. Garantie et réclamations",
        body: [
          "Les produits sont garantis contre les défauts conformément aux articles 197 et suivants du Code des obligations suisse. Tout défaut ou erreur de livraison doit nous être signalé sans délai à contact@soyou.ch, accompagné si possible de photographies.",
        ],
      },
      {
        heading: "9. Ateliers",
        body: [
          "Les ateliers sont proposés sur réservation, généralement le samedi ou exceptionnellement le dimanche. Le tarif et la durée sont précisés au moment de la réservation.",
          "Toute annulation par le client doit être communiquée au moins 48 heures à l'avance ; à défaut, l'atelier pourra être facturé. En cas d'annulation par SoYou Cosmetics, une nouvelle date vous est proposée ou le montant vous est remboursé.",
        ],
      },
      {
        heading: "10. Responsabilité",
        body: [
          "Nos produits étant naturels et artisanaux, il appartient au client de vérifier la compatibilité des ingrédients avec sa peau. SoYou Cosmetics ne saurait être tenue responsable d'une réaction liée à une allergie ou à un usage non conforme. Dans les limites permises par la loi, notre responsabilité est limitée au montant de la commande concernée.",
        ],
      },
      {
        heading: "11. Protection des données",
        body: [
          "Le traitement de vos données personnelles est décrit dans notre Politique de Confidentialité, qui fait partie intégrante des présentes CGV.",
        ],
      },
      {
        heading: "12. Droit applicable et for",
        body: [
          "Les présentes CGV sont soumises au droit suisse. Tout litige relève de la compétence exclusive des tribunaux du canton de Genève, sous réserve d'un for impératif prévu par la loi.",
        ],
      },
    ]}
  />
);

export default TermsPage;

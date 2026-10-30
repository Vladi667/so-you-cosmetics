import React from 'react';
import LegalLayout from '../components/LegalLayout';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';

// Les mentions légales.
//
// Ses propres CGV les exigeaient déjà : l'article 2 dit que la cliente
// reconnaît avoir pris connaissance « des Mentions légales ». La page
// n'existait nulle part — un contrat qui renvoie à un document absent, et
// c'est exactement ce qu'un contrôle méthodique relève.
//
// Deuxième raison, plus quotidienne : l'identité du vendeur — So You SARL,
// CHE-131.511.202 — ne figurait que dans le corps des conditions générales.
// Sur un site marchand, on doit pouvoir savoir à qui l'on achète sans ouvrir
// un contrat de dix-huit articles.

const MentionsPage = () => {
  const { t } = useLanguage();
  useMetadonnees({ titre: t('mentions.title'), description: t('mentions.intro') });
  return (
    <LegalLayout
      title={t('mentions.title')}
      lastUpdated={t('mentions.lastUpdated')}
      intro={t('mentions.intro')}
      sections={t('mentions.sections')}
    />
  );
};

export default MentionsPage;

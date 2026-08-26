import React from 'react';
import LegalLayout from '../components/LegalLayout';
import { useLanguage } from '../i18n/LanguageContext';
import useMetadonnees from '../hooks/useMetadonnees';

const TermsPage = () => {
  const { t } = useLanguage();
  useMetadonnees({ titre: t('terms.title'), description: t('terms.intro') });
  return (
    <LegalLayout
      title={t('terms.title')}
      lastUpdated={t('terms.lastUpdated')}
      intro={t('terms.intro')}
      sections={t('terms.sections')}
    />
  );
};

export default TermsPage;

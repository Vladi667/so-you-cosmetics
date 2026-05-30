import React from 'react';
import LegalLayout from '../components/LegalLayout';
import { useLanguage } from '../i18n/LanguageContext';

const TermsPage = () => {
  const { t } = useLanguage();
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

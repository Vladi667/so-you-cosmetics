import React from 'react';
import LegalLayout from '../components/LegalLayout';
import { useLanguage } from '../i18n/LanguageContext';

const PrivacyPage = () => {
  const { t } = useLanguage();
  return (
    <LegalLayout
      title={t('privacy.title')}
      lastUpdated={t('privacy.lastUpdated')}
      intro={t('privacy.intro')}
      sections={t('privacy.sections')}
    />
  );
};

export default PrivacyPage;

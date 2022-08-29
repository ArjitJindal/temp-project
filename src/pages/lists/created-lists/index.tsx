import React from 'react';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';

const StepForm: React.FC<Record<string, any>> = () => {
  const i18n = useI18n();

  return (
    <PageWrapper
      title={i18n('menu.lists.created-lists')}
      description="Custom lists you have created"
    />
  );
};

export default StepForm;

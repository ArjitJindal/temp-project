import React from 'react';
import RiskAlgorithmTable from './RiskAlgorithm';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { usePageViewTracker } from '@/utils/tracker';

export default function () {
  const i18n = useI18n();
  usePageViewTracker('Risk Algorithm');
  return (
    <Feature name="PULSE" fallback={'Not enabled'}>
      <PageWrapper
        title={i18n('menu.risk-levels.risk-algorithm')}
        description={i18n('menu.risk-levels.risk-algorithm.description')}
      >
        <RiskAlgorithmTable />
      </PageWrapper>
    </Feature>
  );
}

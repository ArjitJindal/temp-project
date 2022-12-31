import React from 'react';
import RiskClassification from './RiskClassification';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { usePageViewTracker } from '@/utils/tracker';

export default function () {
  const i18n = useI18n();
  usePageViewTracker('Risk Algorithm');
  return (
    <Feature name="PULSE" fallback={'Not enabled'}>
      <PageWrapper title={i18n('menu.risk-levels.configure')}>
        <div style={{ maxWidth: '800px' }}>
          <RiskClassification />
        </div>
      </PageWrapper>
    </Feature>
  );
}

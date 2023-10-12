import React from 'react';
import RiskAlgorithmTable from './RiskAlgorithm';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { Authorized } from '@/components/Authorized';

export default function () {
  const i18n = useI18n();
  return (
    <Feature name="RISK_SCORING" fallback={'Not enabled'}>
      <PageWrapper
        title={i18n('menu.risk-levels.risk-algorithms')}
        description={i18n('menu.risk-levels.risk-algorithms.description')}
      >
        <Authorized required={['risk-scoring:risk-algorithms:read']} showForbiddenPage>
          <RiskAlgorithmTable />
        </Authorized>
      </PageWrapper>
    </Feature>
  );
}

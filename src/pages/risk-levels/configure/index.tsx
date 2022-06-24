import React from 'react';
import RiskClassification from './RiskClassification';
import PageWrapper from '@/components/PageWrapper';

export default function () {
  return (
    <PageWrapper>
      <div style={{ maxWidth: '800px' }}>
        <RiskClassification />
      </div>
    </PageWrapper>
  );
}

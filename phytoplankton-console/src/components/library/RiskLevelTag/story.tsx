import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Risk levels'}>
        <PropertyMatrix x={[...RISK_LEVELS, undefined]}>
          {(riskLevel: RiskLevel | undefined) => <Component level={riskLevel} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

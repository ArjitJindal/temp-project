import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { RISK_LEVELS, RiskLevel } from '@/utils/risk-levels';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Dynamic'}>
        {([state, setState]) => (
          <Component
            value={state['riskLevel'] ?? null}
            onChange={(newValue) => {
              setState((prevState) => ({ ...prevState, riskLevel: newValue }));
            }}
          />
        )}
      </UseCase>
      <UseCase title={'All values'}>
        <PropertyMatrix<boolean, RiskLevel> xLabel="isDisabled" x={[false, true]} y={RISK_LEVELS}>
          {(isDisabled, riskLevel) => <Component isDisabled={isDisabled} value={riskLevel} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

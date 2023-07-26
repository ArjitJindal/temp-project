import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { CaseStatus } from '@/apis';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Types'}>
        <PropertyMatrix<CaseStatus> xLabel={'type'} x={['OPEN', 'CLOSED', 'REOPENED', 'ESCALATED']}>
          {(x) => <Component caseStatus={x} previousStatus="OPEN" />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

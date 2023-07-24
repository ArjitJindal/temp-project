import React from 'react';
import Component, { CaseGenerationMethod } from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Types'}>
        <PropertyMatrix<CaseGenerationMethod> xLabel={'type'} x={['SYSTEM', 'MANUAL']}>
          {(x) => <Component method={x} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { CaseType } from '@/apis';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Types'}>
        <PropertyMatrix xLabel={'type'} x={['SYSTEM', 'MANUAL']}>
          {(x) => <Component method={x as CaseType} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

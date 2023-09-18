import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { Priority } from '@/apis';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Types'}>
        <PropertyMatrix<Priority> xLabel={'type'} x={['P1', 'P2', 'P3', 'P4']}>
          {(x) => <Component priority={x} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

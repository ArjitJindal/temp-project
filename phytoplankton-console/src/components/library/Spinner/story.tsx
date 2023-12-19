import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Sizes'}>
        <PropertyMatrix xLabel="Size" x={['SMALL', 'DEFAULT', 'LARGE'] as const}>
          {(size) => <Component size={size} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

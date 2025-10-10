import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';
import { Priority } from '@/apis';
import { PRIORITYS } from '@/apis/models-custom/Priority';

export default function (): JSX.Element {
  return (
    <>
      <UseCase title={'Types'}>
        <PropertyMatrix<Priority> xLabel={'type'} x={PRIORITYS}>
          {(x) => <Component priority={x} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

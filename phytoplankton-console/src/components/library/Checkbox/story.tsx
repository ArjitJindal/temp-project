import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [value, setValue] = useState<undefined | boolean>(false);
  return (
    <>
      <UseCase title={'Basic case'} description="Checkbox input element itself, without label">
        <Component
          value={value}
          onChange={(newValue) => {
            setValue(newValue);
          }}
        />
      </UseCase>
      <UseCase title={'Sizes and states'}>
        <PropertyMatrix
          yLabel={'value'}
          y={[true, undefined, false] as const}
          xLabel={'Sizes'}
          x={['S', 'M', 'L'] as const}
        >
          {(size, value) => <Component value={value} size={size} />}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Disabled'}>
        <PropertyMatrix
          yLabel={'value'}
          y={[true, undefined, false] as const}
          xLabel={'Sizes'}
          x={['S', 'M', 'L'] as const}
        >
          {(size, value) => <Component isDisabled={true} value={value} size={size} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

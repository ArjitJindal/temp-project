import React, { useState } from 'react';
import Component, { Sizes } from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [basicState, setBasicState] = useState<boolean>(true);

  return (
    <>
      <UseCase title={'Basic'}>
        <Component value={basicState} onChange={() => setBasicState((x) => !x)} />
      </UseCase>
      <UseCase title={'Sizes and states'}>
        <PropertyMatrix<Sizes, boolean>
          x={['M', 'S']}
          y={[true, false]}
          xLabel={'size'}
          yLabel={'value'}
        >
          {(x, y) => <Component size={x} value={y} />}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Disabled'}>
        <PropertyMatrix<Sizes, boolean>
          x={['M', 'S']}
          y={[true, false]}
          xLabel={'size'}
          yLabel={'value'}
        >
          {(x, y) => <Component isDisabled={true} size={x} value={y} />}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

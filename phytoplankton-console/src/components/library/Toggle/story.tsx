import React, { useState } from 'react';
import Component, { ToggleSize } from './index';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const onChecked = () => {};
  const [basicState, setBasicState] = useState<boolean>(true);
  const [labelState, setLabelState] = useState<boolean>(true);
  const [largeState, setLargeState] = useState<boolean>(false);
  const [greenState, setGreenState] = useState<boolean>(true);

  return (
    <>
      <UseCase title={'Basic'}>
        <div>
          <div style={{ display: 'block' }}>
            <Component value={basicState} onChange={() => setBasicState(!basicState)} />
          </div>
        </div>
      </UseCase>
      <UseCase title={'With ON/OFF label'}>
        <div>
          <div style={{ display: 'block' }}>
            <Component
              showOnOffLabel
              value={labelState}
              onChange={() => setLabelState(!labelState)}
            />
          </div>
        </div>
      </UseCase>
      <UseCase title={'Disabled'}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '10rem 10rem 10rem',
            gridGap: '1rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'block' }}>
            <Component disabled value={false} onChange={onChecked} />
          </div>
          <div style={{ display: 'block' }}>
            <Component disabled value={true} onChange={onChecked} />
          </div>
          <div style={{ display: 'block' }}>
            <Component showOnOffLabel disabled value={true} onChange={onChecked} />
          </div>
        </div>
      </UseCase>

      <UseCase title={'Sizes and colors'}>
        <PropertyMatrix<ToggleSize, boolean>
          x={['SMALL', 'DEFAULT', 'LARGE']}
          y={[true, false]}
          xLabel={'size'}
          yLabel={'showOnOffLabel'}
        >
          {(x, y) => (
            <Component
              size={x}
              showOnOffLabel={y}
              value={largeState}
              onChange={() => setLargeState(!largeState)}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Greens'}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '10rem 10rem 10rem',
            gridGap: '1rem',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'block' }}>
            <Component green value={greenState} onChange={() => setGreenState(!greenState)} />
          </div>
          <div style={{ display: 'block' }}>
            <Component green value={true} disabled onChange={() => {}} />
          </div>
        </div>
      </UseCase>
    </>
  );
}

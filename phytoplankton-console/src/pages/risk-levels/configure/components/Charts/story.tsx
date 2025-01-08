import { useState } from 'react';
import Chart from './index';
import { UseCase } from '@/pages/storybook/components';
import { makeRandomNumberGenerator } from '@/utils/prng';
import Button from '@/components/library/Button';
import Label from '@/components/library/Label';
import Toggle from '@/components/library/Toggle';

export default function (): JSX.Element {
  const [skeletonMode, setSkeletonMode] = useState(false);

  const [prnd, setPrnd] = useState(() => {
    return makeRandomNumberGenerator();
  });

  const DATA = ['VERY_LOW', 'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'].flatMap((name) => [
    {
      name,
      label: 'Before' as const,
      value: 200 + Math.round(prnd() * 800),
    },
    {
      name,
      label: 'After' as const,
      value: 200 + Math.round(prnd() * 800),
    },
  ]);

  return (
    <>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
        <Button
          onClick={() => {
            setPrnd(() => makeRandomNumberGenerator(Math.random()));
          }}
        >
          New data
        </Button>
        <Label label={'Skeleton mode'} position={'RIGHT'}>
          <Toggle
            size={'XS'}
            value={skeletonMode}
            onChange={(newValue) => setSkeletonMode(newValue ?? false)}
          />
        </Label>
      </div>
      <UseCase title={'RiskSimulationChart'}>
        <Chart data={DATA} max={1000} />
      </UseCase>
    </>
  );
}

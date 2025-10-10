import { useState } from 'react';
import { DeltaChart } from './index';
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
            size={'S'}
            value={skeletonMode}
            onChange={(newValue) => setSkeletonMode(newValue ?? false)}
          />
        </Label>
      </div>
      <UseCase title={'DeltaChart'}>
        <DeltaChart
          title={'Title'}
          beforeValues={[
            {
              value: 100 + prnd() * 500,
              type: 'Before',
            },
            {
              value: 100 + prnd() * 500,
              type: 'True positive (before)',
            },
            {
              value: 100 + prnd() * 1000,
              type: 'False positive (before)',
            },
          ]}
          afterValues={[
            {
              value: 100 + prnd() * 300,
              type: 'After',
            },
            {
              value: 100 + prnd() * 2000,
              type: 'False positive (after)',
            },
            {
              value: 100 + prnd() * 2000,
              type: 'True positive (after)',
            },
          ]}
          beforeColor={'red'}
          beforeFalsePositiveColor={'green'}
          afterColor={'yellow'}
          afterFalsePositiveColor={'blue'}
        />
      </UseCase>
    </>
  );
}

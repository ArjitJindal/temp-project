import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import Icon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import Icon2 from '@/components/ui/icons/Remix/map/sailboat-fill.react.svg';
import Icon3 from '@/components/ui/icons/Remix/map/bus-2-line.react.svg';
import Icon4 from '@/components/ui/icons/Remix/map/flight-land-fill.react.svg';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [selected1, setSelected1] = useState<string>('daily');
  const [selected2, setSelected2] = useState<string>('daily');
  return (
    <>
      <UseCase title={'Sizes and disabled state'}>
        <PropertyMatrix
          x={[false, true] as const}
          y={['SMALL', 'MEDIUM', 'LARGE'] as const}
          xLabel={'isDisabled'}
          yLabel={'size'}
        >
          {(x, y) => (
            <Component
              active={selected1}
              onChange={setSelected1}
              size={y}
              items={[
                { value: 'daily', label: 'Dayly', isDisabled: x },
                { value: 'weekly', label: 'Weekly', isDisabled: x },
                { value: 'monthly', label: 'Monthly', isDisabled: x },
                { value: 'annually', label: 'Annually', isDisabled: x },
              ]}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Icons only'}>
        <PropertyMatrix
          x={[false, true] as const}
          y={['SMALL', 'MEDIUM', 'LARGE'] as const}
          xLabel={'isDisabled'}
          yLabel={'size'}
        >
          {(x, y) => (
            <Component
              active={selected1}
              onChange={setSelected1}
              size={y}
              items={[
                { icon: <Icon />, value: 'daily', isDisabled: x },
                { icon: <Icon2 />, value: 'weekly', isDisabled: x },
                { icon: <Icon3 />, value: 'monthly', isDisabled: x },
                { icon: <Icon4 />, value: 'annually', isDisabled: x },
              ]}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Different combinations'}>
        <Component
          active={selected2}
          onChange={setSelected2}
          items={[
            { value: 'daily', label: 'Dayly' },
            { value: 'weekly', label: 'Weekly', isDisabled: true },
            { value: 'monthly', label: 'Monthly', icon: <Icon /> },
            { value: 'annually', label: 'Annually', isDisabled: true, icon: <Icon /> },
          ]}
        />
      </UseCase>
    </>
  );
}

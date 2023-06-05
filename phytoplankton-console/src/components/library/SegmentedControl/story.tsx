import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import Icon from '@/components/ui/icons/Remix/map/earth-line.react.svg';

export default function (): JSX.Element {
  const [selected1, setSelected1] = useState<string>('daily');
  const [selected2, setSelected2] = useState<string>('daily');
  return (
    <>
      <UseCase title={'Sizes'}>
        <Component
          active={selected1}
          onChange={setSelected1}
          size="LARGE"
          items={[
            { value: 'daily', label: 'Dayly' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'annually', label: 'Annually' },
          ]}
        />
        <Component
          active={selected1}
          onChange={setSelected1}
          size="MEDIUM"
          items={[
            { value: 'daily', label: 'Dayly' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'annually', label: 'Annually' },
          ]}
        />
        <Component
          active={selected1}
          onChange={setSelected1}
          size="SMALL"
          items={[
            { value: 'daily', label: 'Dayly' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'annually', label: 'Annually' },
          ]}
        />
      </UseCase>
      <UseCase title={'States'}>
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

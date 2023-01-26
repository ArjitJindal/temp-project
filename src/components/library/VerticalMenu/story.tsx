import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [active, setActive] = useState('first_item');
  return (
    <UseCase title={'Basic case'}>
      <Component
        active={active}
        onChange={setActive}
        items={[
          {
            key: 'first_item',
            title: 'First item',
          },
          {
            key: 'second_item',
            title: 'Second item',
          },
        ]}
      />
    </UseCase>
  );
}

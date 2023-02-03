import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';

export default function (): JSX.Element {
  const [active, setActive] = useState('first_item');
  return (
    <>
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
      <UseCase title={'With icons'}>
        <Component
          active={active}
          onChange={setActive}
          items={[
            {
              key: 'first_item',
              icon: <User3LineIcon />,
              title: 'First item',
            },
            {
              key: 'second_item',
              icon: <EarthLineIcon />,
              title: 'Second item',
            },
          ]}
        />
      </UseCase>
    </>
  );
}

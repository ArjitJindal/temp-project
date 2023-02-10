import React from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const initialItems = [
    { tab: 'Iteration 1', children: 'Content of Tab 1', key: '1', closable: false },
    { tab: 'Iteration 2', children: 'Content of Tab 2', key: '2' },
    {
      tab: 'Iteration 3',
      children: 'Content of Tab 3',
      key: '3',
    },
  ];
  const disabledItems = [
    { tab: 'Iteration 1', children: 'Content of Tab 1', key: '1', closable: false },
    { tab: 'Iteration 2', children: 'Content of Tab 2', key: '2', disabled: true },
    {
      tab: 'Iteration 3',
      children: 'Content of Tab 3',
      key: '3',
      disabled: true,
    },
  ];

  return (
    <>
      <UseCase title={'Basic Card'}>
        <div>
          <div style={{ display: 'block' }}>
            <Component type="card" items={initialItems} />
          </div>
          <div style={{ display: 'block' }}>
            <Component type="card" items={disabledItems} />
          </div>
        </div>
      </UseCase>
      <UseCase title={'Editable Card'}>
        <div>
          <div style={{ display: 'block' }}>
            <Component type="editable-card" items={initialItems} />
          </div>
        </div>
      </UseCase>
    </>
  );
}

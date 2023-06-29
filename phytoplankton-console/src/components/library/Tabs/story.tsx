import React, { useState } from 'react';
import Component, { TabItem } from './index';
import { UseCase } from '@/pages/storybook/components';

export default function (): JSX.Element {
  const [items, setItems] = useState<TabItem[]>([
    { tab: 'Iteration 1', children: 'Content of Tab 1', key: '1' },
    { tab: 'Iteration 2', children: 'Content of Tab 2', key: '2' },
    { tab: 'Iteration 3', children: 'Content of Tab 3', key: '3' },
    {
      tab: 'Iteration 4',
      children: 'Content of Tab 4',
      key: '4',
      isClosable: false,
    },
    {
      tab: 'Iteration 5',
      children: 'Content of Tab 5',
      key: '5',
      isDisabled: true,
    },
    {
      tab: 'Iteration 6',
      children: 'Content of Tab 6',
      key: '6',
      isClosable: false,
      isDisabled: true,
    },
  ]);

  return (
    <>
      <UseCase title={'Basic Card'}>
        <div>
          <div style={{ display: 'block' }}>
            <Component type="card" items={items} />
          </div>
        </div>
      </UseCase>
      <UseCase title={'Editable Card'}>
        <div>
          <div style={{ display: 'block' }}>
            <Component
              type="editable-card"
              items={items}
              onEdit={(action, key) => {
                if (action === 'add') {
                  setItems((items) => [
                    ...items,
                    {
                      key: `${items.length + 1}`,
                      tab: `New tab #${items.length + 1}`,
                      isClosable: true,
                    },
                  ]);
                } else if (action === 'remove') {
                  setItems((items) => items.filter((x) => x.key !== key));
                }
              }}
            />
          </div>
        </div>
      </UseCase>
    </>
  );
}

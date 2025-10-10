import React, { useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import Component, { TabItem } from './index';
import Flask from '@/components/ui/icons/Remix/health/flask-line.react.svg';
import { UseCase } from '@/pages/storybook/components';
import PropertyMatrix from '@/pages/storybook/components/PropertyMatrix';

export default function (): JSX.Element {
  const [items, setItems] = useState<TabItem[]>([
    { title: 'First tab', children: 'Content of Tab 1', key: '1' },
    { title: 'Another tab with a long title', children: 'Content of Tab 2', key: '2' },
    { title: 'Small', children: 'Content of Tab 3', key: '3' },
    {
      title: 'Iteration 4',
      children: 'Content of Tab 4',
      key: '4',
      isClosable: false,
      Icon: <Flask />,
    },
    {
      title: 'Iteration 5',
      children: 'Content of Tab 5',
      key: '5',
      isDisabled: true,
    },
    {
      title: 'Iteration 6',
      children: 'Content of Tab 6',
      key: '6',
      isClosable: false,
      isDisabled: true,
      Icon: <Flask />,
    },
  ]);
  const [activeKey, setActiveKey] = useState(items[0].key);
  const [counter, setcounter] = useState(items.length + 1);

  const onChange = (newActiveKey: any) => {
    setActiveKey(newActiveKey);
  };

  const add = () => {
    const newActiveKey = `${Number(counter) + 1}`;
    const newPanes = [...items];
    newPanes.push({
      title: `Iteration ${newActiveKey}`,
      children: `Content of Tab ${newActiveKey}`,
      key: newActiveKey,
      isClosable: true,
      isDisabled: false,
    });
    setItems(newPanes);
    setActiveKey(newActiveKey);
    setcounter(counter + 1);
  };

  const remove = (targetKey: string) => {
    let newActiveKey = activeKey;
    let lastIndex = -1;
    items.forEach((item, i) => {
      if (item.key === targetKey) {
        lastIndex = i - 1;
      }
    });
    const newPanes = items.filter((item) => item.key !== targetKey);
    if (newPanes.length && newActiveKey === targetKey) {
      if (lastIndex >= 0) {
        newActiveKey = newPanes[lastIndex].key;
      } else {
        newActiveKey = newPanes[0].key;
      }
    }
    setItems(newPanes);
    setActiveKey(newActiveKey);
  };

  const onEdit = (action: 'add' | 'remove', targetKey: any) => {
    if (action === 'add') {
      add();
    } else {
      remove(targetKey);
    }
  };

  return (
    <>
      <UseCase title={'Horizontal line'}>
        <PropertyMatrix y={['X1', 'X2'] as const} yLabel="Size">
          {(_, size) => (
            <Component
              size={size}
              items={items}
              onChange={(key) => onChange(key)}
              activeKey={activeKey}
            />
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Line'}>
        <div>
          <div style={{ display: 'block' }}>
            <Component
              type="line"
              items={items}
              tabBarGutter={5} //The gap between tabs
            />
          </div>
        </div>
      </UseCase>
      <UseCase title={'Editable Card'}>
        <PropertyMatrix y={['X1', 'X2'] as const} yLabel="Size">
          {(_, size) => (
            <div>
              <div style={{ display: 'block' }}>
                <Component
                  size={size}
                  type="editable-card"
                  items={items}
                  onEdit={(action, key) => onEdit(action, key)}
                />
              </div>
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Editable Card with custom add button'}>
        <PropertyMatrix y={['X1', 'X2'] as const} yLabel="Size">
          {(_, size) => (
            <div>
              <div style={{ display: 'block' }}>
                <Component
                  size={size}
                  addIcon={
                    <div>
                      <PlusOutlined /> Add
                    </div>
                  }
                  type="editable-card"
                  items={items}
                  onEdit={(action, key) => onEdit(action, key)}
                />
              </div>
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Basic Card with large size'}>
        <PropertyMatrix y={['X1', 'X2'] as const} yLabel="Size">
          {(_, size) => (
            <div>
              <div style={{ display: 'block' }}>
                <Component
                  size={size}
                  addIcon={
                    <div>
                      <PlusOutlined /> Add
                    </div>
                  }
                  type="line"
                  items={items}
                  onEdit={(action, key) => onEdit(action, key)}
                />
              </div>
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Tabs with indicator'}>
        <PropertyMatrix y={['X1', 'X2'] as const} yLabel="Size">
          {(_, size) => (
            <div>
              <div style={{ display: 'block' }}>
                <Component
                  size={size}
                  type="line"
                  items={[
                    { title: 'Iteration 1', children: 'Content of Tab 1', key: '1' },
                    {
                      title: 'Iteration 2 (with badge)',
                      showBadge: true,
                      children: 'Content of Tab 2',
                      key: '2',
                    },
                    { title: 'Iteration 3', children: 'Content of Tab 3', key: '3' },
                  ]}
                  onEdit={(action, key) => onEdit(action, key)}
                />
              </div>
            </div>
          )}
        </PropertyMatrix>
      </UseCase>
      <UseCase title={'Vertical line'}>
        <PropertyMatrix x={['X1', 'X2'] as const} xLabel="Size">
          {(size) => (
            <Component
              orientation="VERTICAL"
              type="line"
              items={items}
              onChange={(key) => onChange(key)}
              activeKey={activeKey}
              size={size}
            />
          )}
        </PropertyMatrix>
      </UseCase>
    </>
  );
}

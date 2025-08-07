import { test, describe } from '@jest/globals';

import React, { useState } from 'react';
import { render } from 'testing-library-wrapper';
import Tabs, { Props } from '..';
import {
  expectTabs,
  expectTabDisabled,
  clickTabAdd,
  clickTabDelete,
  expectRootRendered,
} from './tabs.jest-helpers';

describe('Basic rendering for all types', () => {
  describe.each<Props['type']>(['line', 'card', 'editable-card'])('Testing for %p type', (type) => {
    test('Root component renders and visible', async () => {
      render(
        <Tabs
          type={type}
          items={[
            { title: 'First option', key: 'option1' },
            { title: 'Second option', key: 'option2' },
          ]}
        />,
      );
      expectRootRendered();
    });
    test('All tabs are rendered', async () => {
      const tabs = [
        { title: 'First option', key: 'option1' },
        { title: 'Second option', key: 'option2' },
      ];
      render(<Tabs type={type} items={tabs} />);
      expectTabs(tabs.map((tab) => tab.title));
    });
    test('Disabled tabs', async () => {
      const tabs = [
        { title: 'First option, enabled', key: 'option1', isDisabled: false },
        { title: 'Second option, disabled', key: 'option2', isDisabled: true },
      ];
      render(<Tabs type={type} items={tabs} />);
      expectTabs(['First option, enabled', 'Second option, disabled']);
      for (const tab of tabs) {
        expectTabDisabled(tab.title, tab.isDisabled);
      }
    });
  });
});

describe('Editable card', () => {
  test('Adding and deleting items', async () => {
    const initialTabs = [{ title: 'First option', key: 'option1' }];
    render(<RenderTabs type="editable-card" items={initialTabs} />);
    expectTabs(['First option']);
    await clickTabAdd();
    await clickTabAdd();
    expectTabs(['First option', 'New tab #1', 'New tab #2']);
    await clickTabDelete('New tab #1');
    expectTabs(['First option', 'New tab #2']);
    await clickTabDelete('New tab #2');
    expectTabs(['First option']);
  });
});

/*
  Helpers
 */
function RenderTabs(props: Props) {
  const [items, setItems] = useState(props.items);
  const [newTabIndex, setNewTabIndex] = useState(1);
  return (
    <Tabs
      {...props}
      items={items}
      onEdit={(action, key) => {
        if (action === 'add') {
          setItems((prevState) => [
            ...prevState,
            { key: `key_${newTabIndex}`, title: 'New tab #' + newTabIndex },
          ]);
          setNewTabIndex((prevState) => prevState + 1);
        } else if (action === 'remove') {
          setItems((prevState) => prevState.filter((x) => x.key !== key));
        }
      }}
    />
  );
}

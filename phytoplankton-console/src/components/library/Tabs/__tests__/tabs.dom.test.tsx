import { test, expect, describe } from '@jest/globals';

import React, { useState } from 'react';
import { render, screen, within, userEvent } from 'testing-library-wrapper';
import Tabs, { Props } from '..';
import TabsStyles from '../index.module.less';

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
      const rootEl = screen.queryByClassName(TabsStyles.root);
      expect(rootEl).toBeInTheDocument();
      expect(rootEl).toBeVisible();
    });
    test('All tabs are rendered', async () => {
      const tabs = [
        { title: 'First option', key: 'option1' },
        { title: 'Second option', key: 'option2' },
      ];
      render(<Tabs type={type} items={tabs} />);
      for (const tab of tabs) {
        const tabEl = screen.getByText(tab.title);
        expect(tabEl).toBeVisible();
      }
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

async function expectTabs(tabs: string[]) {
  const tabEls = screen.queryAllByRole('tab');
  const titles = tabEls.map((x) => x.textContent?.trim());
  expect(titles).toEqual(tabs);
}

async function expectTabDisabled(title: string, expectedDisabled: boolean) {
  const tabEl = getTabByTitle(title);
  if (expectedDisabled) {
    expect(tabEl).toHaveClass('ant-tabs-tab-disabled');
  } else {
    expect(tabEl).not.toHaveClass('ant-tabs-tab-disabled');
  }
}

async function clickTabAdd() {
  const tabsContainerEl = screen.getByClassName('ant-tabs-nav-wrap');
  const addButtonEl = within(tabsContainerEl).getByClassName('ant-tabs-nav-add');
  await userEvent.click(addButtonEl);
}

async function clickTabDelete(title: string) {
  const tabEl = getTabByTitle(title);
  const deleteButtonEl = within(tabEl).getByClassName('ant-tabs-tab-remove');
  await userEvent.click(deleteButtonEl);
}

function getTabByTitle(title: string) {
  const tabsContainerEl = screen.getByClassName('ant-tabs-nav-wrap');
  const tabEls = within(tabsContainerEl).queryAllByClassName('ant-tabs-tab');
  const titles = tabEls.map((x) => x.textContent);
  expect(titles).toContain(title);
  const result = tabEls.find((x) => within(x).queryByText(title) != null);
  if (!result) {
    throw new Error(`Tab with title "${title}" not found`);
  }
  expect(result).toBeInTheDocument();
  return result;
}

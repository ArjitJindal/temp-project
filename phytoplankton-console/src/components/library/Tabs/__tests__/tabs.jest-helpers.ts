import { screen, within, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import TabsStyles from '../index.module.less';

/**
 * Get a tab by its title
 * @param title The title of the tab
 * @returns The tab element
 */
export function getTabByTitle(title: string): HTMLElement {
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

/**
 * Expect tabs with the given titles to be present
 * @param tabs The expected tab titles
 */
export async function expectTabs(tabs: string[]): Promise<void> {
  const tabEls = screen.queryAllByRole('tab');
  const titles = tabEls.map((x) => x.textContent?.trim());
  expect(titles).toEqual(tabs);
}

/**
 * Expect a tab to be disabled or enabled
 * @param title The title of the tab
 * @param expectedDisabled Whether the tab should be disabled
 */
export async function expectTabDisabled(title: string, expectedDisabled: boolean): Promise<void> {
  const tabEl = getTabByTitle(title);
  if (expectedDisabled) {
    expect(tabEl).toHaveClass('ant-tabs-tab-disabled');
  } else {
    expect(tabEl).not.toHaveClass('ant-tabs-tab-disabled');
  }
}

/**
 * Click the add tab button
 */
export async function clickTabAdd(): Promise<void> {
  const tabsContainerEl = screen.getByClassName('ant-tabs-nav-wrap');
  const addButtonEl = within(tabsContainerEl).getByClassName('ant-tabs-nav-add');
  await userEvent.click(addButtonEl);
}

/**
 * Click the delete button on a tab
 * @param title The title of the tab to delete
 */
export async function clickTabDelete(title: string): Promise<void> {
  const tabEl = getTabByTitle(title);
  const deleteButtonEl = within(tabEl).getByClassName('ant-tabs-tab-remove');
  await userEvent.click(deleteButtonEl);
}

/**
 * Click on a tab
 * @param title The title of the tab to click
 */
export async function clickTab(title: string): Promise<void> {
  const tabEl = getTabByTitle(title);
  await userEvent.click(tabEl);
}

/**
 * Expect the root component to be rendered and visible
 */
export function expectRootRendered(): void {
  const rootEl = screen.queryByClassName(TabsStyles.root);
  expect(rootEl).toBeInTheDocument();
  expect(rootEl).toBeVisible();
}

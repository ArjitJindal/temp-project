import { screen, userEvent, within } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import s from '../style.module.less';
import { notEmpty } from '@/utils/array';

/**
 * Find the select element root
 * @returns The select element
 */
export function findSelectRoot(): HTMLElement {
  return screen.getByClassName(s.root);
}

export function findInputElement(): HTMLElement {
  return screen.getByClassName(s.input);
}

export function findArrowButton(): HTMLElement {
  return screen.getByClassName(s.arrowDownIcon);
}

/**
 * Click on the select element to open the dropdown
 */
export async function clickSelector(): Promise<void> {
  await userEvent.click(findSelectRoot());
}

/**
 * Click on an option in the dropdown by its text
 * @param text Text of the option to select
 */
export async function clickOptionByText(text: string): Promise<void> {
  const dropdownEl = screen.getByClassName(s.menuWrapper);
  const options = within(dropdownEl).getAllByText(text);
  if (options.length === 0) {
    throw new Error(`Option with text "${text}" not found`);
  }
  // If there are multiple options with the same text, select the first one
  const optionEl = options[0];
  await userEvent.click(optionEl);
}

/**
 * Clear all selected values in the select
 */
export async function clickClear(): Promise<void> {
  const clearButtonEl = screen.getByClassName(s.clearIcon);
  expect(clearButtonEl).toBeInTheDocument();
  expect(clearButtonEl).toBeVisible();
  await userEvent.click(clearButtonEl);
}

/**
 * Remove a specific value from a multi-select by its text
 * @param text Text of the value to remove
 */
export async function clickValueRemove(text: string): Promise<void> {
  const tagEls = screen.getAllByClassName(s.tagWrapper);
  const tagEl = tagEls.find((item) => item.textContent === text);
  if (tagEl == null) {
    throw new Error(`Tag with text "${text}" not found`);
  }
  const removeEl = within(tagEl).getByClassName(s.tagRemoveIcon);
  await userEvent.click(removeEl);
}

/**
 * Click outside the select to close the dropdown
 */
export async function clickOutside(): Promise<void> {
  await userEvent.click(document.body);
}

/**
 * Check if the dropdown is open or closed
 * @param shouldBeOpen Expected state of the dropdown
 */
export function expectDropdownOpen(shouldBeOpen: boolean = true): void {
  const dropdownEl = screen.getByClassName(s.menuWrapper);
  expect(dropdownEl).toBeInTheDocument();
  expect(dropdownEl).toBeTruthy();
  const classList = Array.from(dropdownEl.classList);

  if (shouldBeOpen) {
    expect(classList.includes(s.isOpen)).toBeTruthyOrMessage(
      "Select menu wrapper's class list expected to have 'isOpen' class, but it's not",
    );
  } else {
    expect(!classList.includes(s.isOpen)).toBeTruthyOrMessage(
      "Select menu wrapper's class list expected NOT to have 'isOpen' class, but it is there",
    );
  }
}

/**
 * Verify the selected values in the select component
 * @param values Expected values as displayed text
 */
export function expectValues(values: string[]): void {
  const selectorEl = findSelectRoot();
  const items = within(selectorEl).queryAllByClassName(s.selectedOptionLabel);
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}

/**
 * Verify the selected tags in the select component
 * @param values Expected tag values as displayed text
 */
export function expectTags(values: string[]): void {
  const items = screen.queryAllByClassName(s.tagWrapper);
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}

/**
 * Type text into a select's input
 * @param text Text to type
 */
export async function typeInSelect(text: string): Promise<void> {
  await userEvent.keyboard(text);
}

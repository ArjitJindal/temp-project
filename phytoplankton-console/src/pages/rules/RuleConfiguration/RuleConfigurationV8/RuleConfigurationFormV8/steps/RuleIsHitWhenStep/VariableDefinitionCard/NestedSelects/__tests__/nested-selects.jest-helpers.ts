import { screen, within, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import { notEmpty } from '@/utils/array';
import LabelStyles from '@/components/library/Label/style.module.less';
import SelectStyles from '@/components/library/Select/style.module.less';

/**
 * Find a select component by its label text
 * @param selectLabel The label text to search for
 * @returns The select element container
 */
export async function findSelect(selectLabel: string) {
  const allLabelContainers = await screen.findAllByClassName(LabelStyles.root);
  const matchingLabels = allLabelContainers.filter((x) => {
    const labelEl = within(x).getByClassName(LabelStyles.label);
    const text = labelEl != null ? labelEl.textContent?.trim() : undefined;
    return text === selectLabel || text === `${selectLabel} *`;
  });
  expect(matchingLabels).toHaveLength(1);
  const label = matchingLabels[0];
  const select = within(label).getByClassName(SelectStyles.root);
  return select;
}

/**
 * Verifies the number of select components present
 * @param number Expected number of selects
 */
export async function expectSelectNumber(number: number) {
  const allLabelContainers = await screen.findAllByClassName(LabelStyles.root);
  return expect(allLabelContainers).toHaveLength(number);
}

/**
 * Select an option in a dropdown by its text
 * @param select The select element
 * @param option Text of the option to select
 */
export async function selectOption(select: HTMLElement, option: string) {
  await userEvent.click(select);
  expectDropdownOpen(select, true);

  const dropdownEl = getDropdownBySelect(select);
  const options = within(dropdownEl).getAllByText(option);
  if (options.length === 0) {
    throw new Error(`Option with text "${option}" not found`);
  }
  // If there are multiple options with the same text, select the first one
  const optionEl = options[0];
  await userEvent.click(optionEl);

  expectDropdownOpen(select, false);
}

/**
 * Clear the selected value in a select component
 * @param select The select element
 */
export async function clickClear(select: HTMLElement) {
  const clearButtonEl = within(select).getByClassName(SelectStyles.clearIcon);
  expect(clearButtonEl).toBeInTheDocument();
  expect(clearButtonEl).toBeVisible();
  await userEvent.click(clearButtonEl);
}

/**
 * Get the dropdown element associated with a select
 * @param select The select element
 * @returns The dropdown element
 */
export function getDropdownBySelect(select: HTMLElement): HTMLElement {
  const portalId = select.getAttribute('data-portal-id');
  if (!portalId) {
    throw new Error('Portal ID not found');
  }
  const portalEl = document.getElementById(portalId);
  if (!portalEl) {
    throw new Error('Portal element not found');
  }
  const dropdownEl = within(portalEl).getByClassName(SelectStyles.menuWrapper);
  return dropdownEl;
}

/**
 * Check if a dropdown is open
 * @param select The select element
 * @param shouldBeOpen Whether the dropdown should be open
 */
export function expectDropdownOpen(select: HTMLElement, shouldBeOpen: boolean = true) {
  const dropdownEl = getDropdownBySelect(select);
  expect(dropdownEl).toBeInTheDocument();
  if (shouldBeOpen) {
    expect(dropdownEl).toHaveClass(SelectStyles.isOpen);
  } else {
    expect(dropdownEl).not.toHaveClass(SelectStyles.isOpen);
  }
}

/**
 * Verify the selected values in a select component
 * @param select The select element
 * @param values Expected values as displayed text
 */
export function expectValues(select: HTMLElement, values: string[]) {
  const items = within(select).queryAllByClassName(SelectStyles.selectedOptionLabel);
  const itemsText = items.map((item) => item.textContent).filter(notEmpty);
  expect(itemsText).toEqual(values);
}

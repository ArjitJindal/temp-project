import { expect } from '@jest/globals';
import { screen, userEvent } from 'testing-library-wrapper';
import s from '../style.module.less';

/**
 * Find a checkbox by its test name
 * @param testName The test name attribute of the checkbox
 * @returns The checkbox element
 */
export function findCheckboxByTestName(testName: string): HTMLElement {
  return screen.getByTestId(`${testName}-checkbox`);
}

/**
 * Click on a checkbox
 * @param testName The test name attribute of the checkbox
 */
export async function clickCheckbox(testName: string): Promise<void> {
  const checkbox = findCheckboxByTestName(testName);
  await userEvent.click(checkbox);
}

/**
 * Expect a checkbox to be checked
 * @param testName The test name attribute of the checkbox
 * @param isChecked Whether the checkbox should be checked
 */
export function expectCheckboxChecked(testName: string, isChecked: boolean): void {
  const checkbox = findCheckboxByTestName(testName) as HTMLInputElement;
  if (isChecked) {
    expect(checkbox).toBeChecked();
  } else {
    expect(checkbox).not.toBeChecked();
  }
}

/**
 * Expect a checkbox to be disabled
 * @param testName The test name attribute of the checkbox
 * @param isDisabled Whether the checkbox should be disabled
 */
export function expectCheckboxDisabled(testName: string, isDisabled: boolean): void {
  const checkbox = findCheckboxByTestName(testName);
  if (isDisabled) {
    expect(checkbox).toBeDisabled();
  } else {
    expect(checkbox).not.toBeDisabled();
  }
}

/**
 * Expect a checkbox to be in indeterminate state
 * @param testName The test name attribute of the checkbox
 * @param isIndeterminate Whether the checkbox should be in indeterminate state
 */
export function expectCheckboxIndeterminate(testName: string, isIndeterminate: boolean): void {
  const checkbox = screen.getByTestId(`${testName}-checkbox`);
  const parent = checkbox.parentElement;

  if (!parent) {
    throw new Error(`Checkbox parent element not found`);
  }

  if (isIndeterminate) {
    expect(parent.querySelector(`.${s.isIndeterminate}`)).not.toBeNull();
  } else {
    expect(parent.querySelector(`.${s.isIndeterminate}`)).toBeNull();
  }
}

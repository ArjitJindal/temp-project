import { screen, fireEvent, waitFor } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find an option by its label text
 * @param label The label text of the option
 * @returns The option element
 */
export function findOptionByLabel(label: string): HTMLElement {
  return screen.getByText(label);
}

/**
 * Find a checkbox by its label and description
 * @param label The label text of the option
 * @param description The description text of the option
 * @returns The checkbox element
 */
export function findCheckboxByLabelAndDescription(label: string, description: string): HTMLElement {
  return screen.getByRole('checkbox', { name: `${label} ${description}` });
}

/**
 * Click on an option by its label
 * @param label The label text of the option
 */
export async function clickOption(label: string): Promise<void> {
  const option = findOptionByLabel(label);
  fireEvent.click(option);
}

/**
 * Check or uncheck a checkbox option
 * @param label The label text of the option
 * @param description The description text of the option
 * @param checked Whether the checkbox should be checked
 */
export async function setCheckboxState(
  label: string,
  description: string,
  checked: boolean,
): Promise<void> {
  const checkbox = findCheckboxByLabelAndDescription(label, description);
  fireEvent.change(checkbox, { target: { checked } });
}

/**
 * Expect an option to be in the document
 * @param label The label text of the option
 * @param description The description text of the option
 */
export function expectOptionPresent(label: string, description: string): void {
  expect(screen.getByText(label)).toBeInTheDocument();
  expect(screen.getByText(description)).toBeInTheDocument();
}

/**
 * Expect a checkbox to be checked or unchecked
 * @param label The label text of the option
 * @param description The description text of the option
 * @param isChecked Whether the checkbox should be checked
 */
export function expectCheckboxState(label: string, description: string, isChecked: boolean): void {
  const checkbox = findCheckboxByLabelAndDescription(label, description);
  if (isChecked) {
    expect(checkbox).toBeChecked();
  } else {
    expect(checkbox).not.toBeChecked();
  }
}

/**
 * Expect a checkbox to be disabled or enabled
 * @param label The label text of the option
 * @param description The description text of the option
 * @param isDisabled Whether the checkbox should be disabled
 */
export function expectCheckboxDisabled(
  label: string,
  description: string,
  isDisabled: boolean,
): void {
  const checkbox = findCheckboxByLabelAndDescription(label, description);
  if (isDisabled) {
    expect(checkbox).toBeDisabled();
  } else {
    expect(checkbox).not.toBeDisabled();
  }
}

/**
 * Wait for a checkbox to be checked or unchecked
 * @param label The label text of the option
 * @param description The description text of the option
 * @param isChecked Whether the checkbox should be checked
 */
export async function waitForCheckboxState(
  label: string,
  description: string,
  isChecked: boolean,
): Promise<void> {
  const checkbox = findCheckboxByLabelAndDescription(label, description);
  await waitFor(() => {
    if (isChecked) {
      expect(checkbox).toBeChecked();
    } else {
      expect(checkbox).not.toBeChecked();
    }
  });
}

/**
 * Expect multiple options to be present in the document
 * @param options Array of objects with label and description
 */
export function expectOptionsPresent(options: Array<{ label: string; description: string }>): void {
  options.forEach((option) => {
    expectOptionPresent(option.label, option.description);
  });
}

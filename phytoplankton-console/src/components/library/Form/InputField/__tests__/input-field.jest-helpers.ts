import { screen, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Finds an input field by its label text
 * @param labelText The label text to search for
 * @returns The input field element
 */
export async function findInputFieldByLabel(labelText: string): Promise<HTMLElement> {
  return screen.findByText(labelText);
}

/**
 * Finds a text input element by its label text
 * @param labelText The label text to search for
 * @returns The input element
 */
export async function findTextInputByLabel(labelText: string): Promise<HTMLElement> {
  await findInputFieldByLabel(labelText);
  return screen.getByRole('textbox');
}

/**
 * Finds a select input element by its label text
 * @param labelText The label text to search for
 * @returns The select element
 */
export async function findSelectByLabel(labelText: string): Promise<HTMLElement> {
  await findInputFieldByLabel(labelText);
  return screen.getByRole('combobox');
}

/**
 * Types text into a text input field
 * @param labelText The label text of the input field
 * @param text The text to type
 */
export async function typeIntoInputField(labelText: string, text: string): Promise<void> {
  const inputEl = await findTextInputByLabel(labelText);
  await userEvent.click(inputEl);
  await userEvent.keyboard(text);
}

/**
 * Clears a text input field
 * @param labelText The label text of the input field
 */
export async function clearInputField(labelText: string): Promise<void> {
  const inputEl = await findTextInputByLabel(labelText);
  await userEvent.click(inputEl);
  await userEvent.clear(inputEl);
}

/**
 * Checks if an input field has an error message
 * @param errorMessage The error message to check for
 */
export function expectErrorMessage(errorMessage: string): void {
  expect(errorMessage).toBe('This field is required');
}

/**
 * Checks if a label is visible or hidden
 * @param labelText The label text to check for
 * @param isVisible Whether the label should be visible
 */
export function expectLabelVisibility(labelText: string, isVisible: boolean): void {
  if (isVisible) {
    expect(screen.getByText(labelText)).toBeInTheDocument();
  } else {
    expect(screen.queryByText(labelText)).toBeNull();
  }
}

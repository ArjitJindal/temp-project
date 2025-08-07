import { screen, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find a radio button
 * @returns The radio button element
 */
export function findRadio(): HTMLElement {
  return screen.getByRole('checkbox');
}

/**
 * Click on a radio button
 */
export async function clickRadio(): Promise<void> {
  const radio = findRadio();
  await userEvent.click(radio);
}

/**
 * Expect a radio button to be checked
 * @param isChecked Whether the radio button should be checked
 */
export function expectRadioChecked(isChecked: boolean): void {
  const radio = findRadio() as HTMLInputElement;
  if (isChecked) {
    expect(radio).toBeChecked();
  } else {
    expect(radio).not.toBeChecked();
  }
}

/**
 * Expect a radio button to be disabled
 * @param isDisabled Whether the radio button should be disabled
 */
export function expectRadioDisabled(isDisabled: boolean): void {
  const radio = findRadio();
  if (isDisabled) {
    expect(radio).toBeDisabled();
  } else {
    expect(radio).not.toBeDisabled();
  }
}

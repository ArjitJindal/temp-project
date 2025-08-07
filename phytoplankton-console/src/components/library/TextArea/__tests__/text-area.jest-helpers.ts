import { screen, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import TextAreaStyles from '../styles.module.less';

/**
 * Get the textarea element
 * @returns The textarea element
 */
export function getInput(): HTMLElement {
  return screen.getByRole('textbox');
}

/**
 * Get the border color of the textarea
 * @returns The border color
 */
export function getBorderColor(): string {
  const rootEl = screen.getByClassName(TextAreaStyles.input);
  const style = window.getComputedStyle(rootEl);
  return style.getPropertyValue('border-color').toUpperCase();
}

/**
 * Type text into the textarea
 * @param text The text to type
 */
export async function typeIntoTextArea(text: string): Promise<void> {
  const input = getInput();
  await userEvent.click(input);
  await userEvent.keyboard(text);
}

/**
 * Clear the textarea
 */
export async function clearTextArea(): Promise<void> {
  const input = getInput();
  await userEvent.clear(input);
}

/**
 * Expect the textarea to have a specific value
 * @param value The expected value
 */
export function expectTextAreaValue(value: string): void {
  const input = getInput();
  expect(input).toHaveValue(value);
}

/**
 * Expect the textarea to be disabled or not
 * @param isDisabled Whether the textarea should be disabled
 */
export function expectTextAreaDisabled(isDisabled: boolean): void {
  const input = getInput();
  if (isDisabled) {
    expect(input).toBeDisabled();
  } else {
    expect(input).not.toBeDisabled();
  }
}

/**
 * Expect the textarea to have a specific border color
 * @param color The expected color
 */
export function expectBorderColor(color: string): void {
  const borderColor = getBorderColor();
  expect(borderColor).toBeColor(color);
}

/**
 * Click the textarea
 */
export async function clickTextArea(): Promise<void> {
  const input = getInput();
  await userEvent.click(input);
}

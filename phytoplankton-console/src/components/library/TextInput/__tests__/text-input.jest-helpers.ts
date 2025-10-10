import { screen, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import TextInputStyles from '../style.module.less';

/**
 * Get the input element
 * @returns The input element
 */
export function getInput(): HTMLElement {
  return screen.getByRole('textbox');
}

/**
 * Get the clear button
 * @returns The clear button element
 */
export function getClearButton(): HTMLElement {
  return screen.getByRole('button', { name: 'Clear' });
}

/**
 * Get the border color of the input wrapper
 * @returns The border color
 */
export function getBorderColor(): string {
  const rootEl = screen.getByClassName(TextInputStyles.inputWrapper);
  const style = window.getComputedStyle(rootEl);
  return style.getPropertyValue('border-color').toUpperCase();
}

/**
 * Type text into the input field
 * @param text The text to type
 */
export async function typeIntoInput(text: string): Promise<void> {
  const input = getInput();
  await userEvent.click(input);
  await userEvent.keyboard(text);
}

/**
 * Clear the input field
 */
export async function clearInput(): Promise<void> {
  const clearBtn = getClearButton();
  await userEvent.click(clearBtn);
}

/**
 * Expect the input to have a specific value
 * @param value The expected value
 */
export function expectInputValue(value: string): void {
  const input = getInput();
  expect(input).toHaveValue(value);
}

/**
 * Expect the input to be disabled or not
 * @param isDisabled Whether the input should be disabled
 */
export function expectInputDisabled(isDisabled: boolean): void {
  const input = getInput();
  if (isDisabled) {
    expect(input).toBeDisabled();
  } else {
    expect(input).not.toBeDisabled();
  }
}

/**
 * Expect the input to have a specific border color
 * @param color The expected color
 */
export function expectBorderColor(color: string): void {
  const borderColor = getBorderColor();
  expect(borderColor).toBeColor(color);
}

/**
 * Click the input field
 */
export async function clickInput(): Promise<void> {
  const input = getInput();
  await userEvent.click(input);
}

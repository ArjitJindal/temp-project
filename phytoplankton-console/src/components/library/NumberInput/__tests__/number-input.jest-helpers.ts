import { screen, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import { Styles as NumberInputStyles } from '..';
import {
  FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION,
  FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR,
  FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY,
} from '@/components/ui/colors';

/**
 * Find the input element by role
 * @returns The input element
 */
export function getInput(): HTMLElement {
  return screen.getByRole('textbox');
}

/**
 * Find the clear button by role and name
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
  const rootEl = screen.getByClassName(NumberInputStyles.inputWrapper);
  const style = window.getComputedStyle(rootEl);
  return style.getPropertyValue('border-color').toUpperCase();
}

/**
 * Type text into the input
 * @param value The text to type
 */
export async function typeIntoInput(value: string): Promise<void> {
  const inputEl = getInput();
  await userEvent.click(inputEl);

  if (value === '') {
    const currentValue = inputEl.getAttribute('value') || '';
    if (currentValue.length > 0) {
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.keyboard('{Delete}');
    }
    return;
  }

  for (let i = 0; i < value.length; i++) {
    await userEvent.keyboard(value[i]);
  }
}

/**
 * Clear the input using backspace
 * @param length The number of backspaces to press
 */
export async function clearInputByBackspace(): Promise<void> {
  await userEvent.keyboard('{Control>}a{/Control}');
  await userEvent.keyboard('{Delete}');
}

/**
 * Clear the input using the clear button
 */
export async function clearInputWithButton(): Promise<void> {
  const clearBtn = getClearButton();
  await userEvent.click(clearBtn);
}

/**
 * Expect the input to have a specific value
 * @param value The expected value
 */
export function expectInputValue(value: string): void {
  const inputEl = getInput();
  expect(inputEl).toHaveDisplayValue(value);
}

/**
 * Expect the input to be disabled or not
 * @param isDisabled Whether the input should be disabled
 */
export function expectInputDisabled(isDisabled: boolean = true): void {
  const inputEl = getInput();
  if (isDisabled) {
    expect(inputEl).toBeDisabled();
  } else {
    expect(inputEl).not.toBeDisabled();
  }
}

/**
 * Expect the input to have a specific border color
 * @param color The expected border color
 */
export function expectBorderColor(color: string): void {
  const borderColor = getBorderColor();
  expect(borderColor).toEqual(color);
}

/**
 * Expect the input to have the focused border color
 */
export function expectFocusedBorderColor(): void {
  expectBorderColor(FIGMA_VARS_TOKENS_COLOR_STROKE_ACTION);
}

/**
 * Expect the input to have the error border color
 */
export function expectErrorBorderColor(): void {
  expectBorderColor(FIGMA_VARS_TOKENS_COLOR_STROKE_ERROR);
}

/**
 * Expect the input to have the disabled border color
 */
export function expectDisabledBorderColor(): void {
  expectBorderColor(FIGMA_VARS_TOKENS_COLOR_STROKE_TERTIARY);
}

/**
 * Tab out of the input
 */
export async function tabOutOfInput(): Promise<void> {
  await userEvent.keyboard('{Tab}');
}

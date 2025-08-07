import { screen, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find a button by its text
 * @param text The text content of the button
 * @returns The button element
 */
export function findButtonByText(text: string): HTMLElement {
  return screen.getByText(text);
}

/**
 * Click on a button
 * @param text The text content of the button
 */
export async function clickButton(text: string): Promise<void> {
  const button = findButtonByText(text);
  await userEvent.click(button);
}

/**
 * Expect a button to be disabled
 * @param text The text content of the button
 * @param isDisabled Whether the button should be disabled
 */
export function expectButtonDisabled(text: string, isDisabled: boolean): void {
  const button = findButtonByText(text);
  if (isDisabled) {
    expect(button).toBeDisabled();
  } else {
    expect(button).not.toBeDisabled();
  }
}

/**
 * Expect a button to have a specific type class
 * @param text The text content of the button
 * @param type The button type (PRIMARY, SECONDARY, TETRIARY, TEXT, DANGER)
 */
export function expectButtonType(text: string, type: string): void {
  const button = findButtonByText(text);
  const classNames = Array.from(button.classList);
  const hasTypeClass = classNames?.some((className) => className.includes(`type-${type}`));
  expect(hasTypeClass).toBe(true);
}

/**
 * Expect a button to have a specific size class
 * @param text The text content of the button
 * @param size The button size (SMALL, MEDIUM, LARGE)
 */
export function expectButtonSize(text: string, size: string): void {
  const button = findButtonByText(text);
  const classNames = Array.from(button.classList);
  const hasSizeClass = classNames?.some((className) => className.includes(`size-${size}`));
  expect(hasSizeClass).toBe(true);
}

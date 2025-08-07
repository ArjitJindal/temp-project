import { screen, fireEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find a step button by its text
 * @param text The button text
 * @returns The button element
 */
export function findButton(text: string): HTMLElement {
  return screen.getByText(text);
}

/**
 * Find the Previous button
 * @returns The Previous button element
 */
export function findPreviousButton(): HTMLElement {
  return findButton('Previous');
}

/**
 * Find the Next button
 * @returns The Next button element
 */
export function findNextButton(): HTMLElement {
  return findButton('Next');
}

/**
 * Find the action button by its text
 * @param text The action button text
 * @returns The action button element
 */
export function findActionButton(text: string): HTMLElement {
  return findButton(text);
}

/**
 * Click the Previous button
 */
export async function clickPreviousButton(): Promise<void> {
  const button = findPreviousButton();
  await fireEvent.click(button);
}

/**
 * Click the Next button
 */
export async function clickNextButton(): Promise<void> {
  const button = findNextButton();
  await fireEvent.click(button);
}

/**
 * Click the action button
 * @param text The action button text
 */
export async function clickActionButton(text: string): Promise<void> {
  const button = findActionButton(text);
  await fireEvent.click(button);
}

/**
 * Expect a button to be disabled or not
 * @param text The button text
 * @param isDisabled Whether the button should be disabled
 */
export function expectButtonDisabled(text: string, isDisabled: boolean): void {
  const button = findButton(text);
  if (isDisabled) {
    expect(button).toBeDisabled();
  } else {
    expect(button).not.toBeDisabled();
  }
}

/**
 * Expect the Previous button to be disabled or not
 * @param isDisabled Whether the button should be disabled
 */
export function expectPreviousButtonDisabled(isDisabled: boolean): void {
  expectButtonDisabled('Previous', isDisabled);
}

/**
 * Expect the Next button to be disabled or not
 * @param isDisabled Whether the button should be disabled
 */
export function expectNextButtonDisabled(isDisabled: boolean): void {
  expectButtonDisabled('Next', isDisabled);
}

/**
 * Expect the action button to be disabled or not
 * @param text The action button text
 * @param isDisabled Whether the button should be disabled
 */
export function expectActionButtonDisabled(text: string, isDisabled: boolean): void {
  expectButtonDisabled(text, isDisabled);
}

/**
 * Expect a button to be visible
 * @param text The button text
 */
export function expectButtonVisible(text: string): void {
  const button = findButton(text);
  expect(button).toBeInTheDocument();
}

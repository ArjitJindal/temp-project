import { screen, fireEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find the toggle element
 * @param testId Optional test ID for the toggle (defaults to 'anonymous-toggle')
 * @returns The toggle element
 */
export function findToggle(testId: string = 'anonymous-toggle'): HTMLElement {
  return screen.getByTestId(testId);
}

/**
 * Find the toggle background element
 * @param testId Optional test ID for the toggle background (defaults to 'anonymous-toggle-bg')
 * @returns The toggle background element
 */
export function findToggleBackground(testId: string = 'anonymous-toggle-bg'): HTMLElement {
  return screen.getByTestId(testId);
}

/**
 * Click the toggle
 * @param testId Optional test ID for the toggle (defaults to 'anonymous-toggle')
 */
export async function clickToggle(testId: string = 'anonymous-toggle'): Promise<void> {
  const toggle = findToggle(testId);
  await fireEvent.click(toggle);
}

/**
 * Expect the toggle to be checked or not
 * @param isChecked Whether the toggle should be checked
 * @param testId Optional test ID for the toggle (defaults to 'anonymous-toggle')
 */
export function expectToggleChecked(isChecked: boolean, testId: string = 'anonymous-toggle'): void {
  const toggle = findToggle(testId);
  if (isChecked) {
    expect(toggle).toBeChecked();
  } else {
    expect(toggle).not.toBeChecked();
  }
}

/**
 * Expect the toggle to be disabled or not
 * @param isDisabled Whether the toggle should be disabled
 * @param testId Optional test ID for the toggle (defaults to 'anonymous-toggle')
 */
export function expectToggleDisabled(
  isDisabled: boolean,
  testId: string = 'anonymous-toggle',
): void {
  const toggle = findToggle(testId);
  if (isDisabled) {
    expect(toggle).toBeDisabled();
  } else {
    expect(toggle).not.toBeDisabled();
  }
}

/**
 * Expect the toggle background to have a specific color
 * @param expectedColor The expected color (e.g., 'rgb(17, 105, 249)')
 * @param testId Optional test ID for the toggle background (defaults to 'anonymous-toggle-bg')
 */
export function expectToggleBackgroundColor(
  expectedColor: string,
  testId: string = 'anonymous-toggle-bg',
): void {
  const toggleBackground = findToggleBackground(testId);
  const backgroundColor = getComputedStyle(toggleBackground as any).backgroundColor;
  expect(backgroundColor).toBe(expectedColor);
}

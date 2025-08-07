import { screen } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find the button group container
 * @returns The button group element
 */
export function findButtonGroup(): HTMLElement {
  return screen.getByTestId('button-group');
}

/**
 * Find all buttons within the button group
 * @returns Array of button elements
 */
export function findAllButtons(): HTMLElement[] {
  return screen.getAllByRole('button');
}

/**
 * Find a button by its text
 * @param text The text content of the button
 * @returns The button element
 */
export function findButtonByText(text: string): HTMLElement {
  return screen.getByText(text);
}

/**
 * Expect the button group to have a specific number of buttons
 * @param count The expected number of buttons
 */
export function expectButtonCount(count: number): void {
  const buttons = findAllButtons();
  expect(buttons).toHaveLength(count);
}

/**
 * Expect buttons to have specific text content
 * @param buttonTexts Array of expected button text content
 */
export function expectButtonTexts(buttonTexts: string[]): void {
  const buttons = findAllButtons();
  buttonTexts.forEach((text, index) => {
    expect(buttons[index]).toHaveTextContent(text);
  });
}

/**
 * Expect the button group to have a specific gap
 * @param gap The expected gap in pixels
 */
export function expectButtonGroupGap(gap: number): void {
  const buttonGroupDiv = findButtonGroup();
  expect(buttonGroupDiv).toHaveStyle(`gap: ${gap}px`);
}

/**
 * Expect the button group to not have a gap style
 */
export function expectNoGapStyle(): void {
  const buttonGroupDiv = findButtonGroup();
  const styleAttribute = buttonGroupDiv.getAttribute('style');
  expect(styleAttribute).toBeFalsy();
}

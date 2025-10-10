import { screen, fireEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import s from '../index.module.less';

/**
 * Find the drawer title element
 * @param title The title text
 * @returns The title element
 */
export function findDrawerTitle(title: string): HTMLElement {
  return screen.getByText(title);
}

/**
 * Find the drawer close button
 * @returns The close button element
 */
export function findCloseButton(): HTMLElement {
  return screen.getByTestId('drawer-close-button');
}

/**
 * Find drawer content by text
 * @param content The content text
 * @returns The content element
 */
export function findDrawerContent(content: string): HTMLElement {
  return screen.getByText(content);
}

/**
 * Find drawer footer content by text
 * @param content The footer content text
 * @returns The footer content element
 */
export function findFooterContent(content: string): HTMLElement {
  return screen.getByText(content);
}

/**
 * Find drawer description
 * @param description The description text
 * @returns The description element
 */
export function findDescription(description: string): HTMLElement {
  return screen.getByText(description);
}

/**
 * Find confirmation dialog text
 * @param text The confirmation dialog text
 * @returns The confirmation dialog element
 */
export function findConfirmationDialog(text: string): HTMLElement {
  return screen.getByText(text);
}

/**
 * Find button in the drawer by text
 * @param buttonText The button text
 * @returns The button element
 */
export function findButton(buttonText: string): HTMLElement {
  return screen.getByText(buttonText);
}

/**
 * Click the drawer close button
 */
export async function clickCloseButton(): Promise<void> {
  const closeButton = findCloseButton();
  await fireEvent.click(closeButton);
}

/**
 * Click a button in the drawer by text
 * @param buttonText The button text
 */
export async function clickButton(buttonText: string): Promise<void> {
  const button = findButton(buttonText);
  await fireEvent.click(button);
}

/**
 * Expect footer sections to have specific alignment
 * @param alignment The expected alignment ('left' or 'right')
 */
export function expectFooterAlignment(alignment: 'left' | 'right'): void {
  const footerSections = screen.getAllByClassName(s.footerSection);
  expect(footerSections.length).toBeGreaterThan(0);
  const footerSection = footerSections[0];
  expect(footerSection).toHaveClass(s[alignment]);
}

/**
 * Expect confirmation dialog to be visible or not
 * @param isVisible Whether the confirmation dialog should be visible
 * @param text Optional text to check for in the dialog
 */
export function expectConfirmationDialogVisible(isVisible: boolean, text?: string): void {
  if (isVisible && text) {
    const dialog = screen.queryByText(text);
    expect(dialog).toBeInTheDocument();
  } else if (!isVisible && text) {
    const dialog = screen.queryByText(text);
    expect(dialog).not.toBeInTheDocument();
  }
}

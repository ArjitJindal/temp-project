import { screen, fireEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find the modal title element
 * @param title The title text
 * @returns The title element
 */
export function findModalTitle(title: string): HTMLElement {
  return screen.getByText(title);
}

/**
 * Find the modal close button
 * @returns The close button element
 */
export function findCloseButton(): HTMLElement {
  return screen.getByTestId('modal-close');
}

/**
 * Find the modal OK button
 * @param customText Custom text for the OK button
 * @returns The OK button element
 */
export function findOkButton(customText?: string): HTMLElement {
  if (customText) {
    return screen.getByText(customText);
  }
  return screen.getByTestId('modal-ok');
}

/**
 * Find the modal cancel button
 * @param customText Custom text for the cancel button
 * @returns The cancel button element
 */
export function findCancelButton(customText?: string): HTMLElement {
  if (customText) {
    return screen.getByText(customText);
  }
  return screen.getByTestId('modal-cancel');
}

/**
 * Find a tab by its title
 * @param tabTitle The tab title text
 * @returns The tab element
 */
export function findTab(tabTitle: string): HTMLElement {
  return screen.getByText(tabTitle);
}

/**
 * Find tab content by its text
 * @param contentText The content text
 * @returns The content element
 */
export function findTabContent(contentText: string): HTMLElement {
  return screen.getByText(contentText);
}

/**
 * Click the modal close button
 */
export async function clickCloseButton(): Promise<void> {
  const closeButton = findCloseButton();
  await fireEvent.click(closeButton);
}

/**
 * Click the modal OK button
 * @param customText Custom text for the OK button
 */
export async function clickOkButton(customText?: string): Promise<void> {
  const okButton = findOkButton(customText);
  await fireEvent.click(okButton);
}

/**
 * Click the modal cancel button
 * @param customText Custom text for the cancel button
 */
export async function clickCancelButton(customText?: string): Promise<void> {
  const cancelButton = findCancelButton(customText);
  await fireEvent.click(cancelButton);
}

/**
 * Click on a tab
 * @param tabTitle The tab title text
 */
export async function clickTab(tabTitle: string): Promise<void> {
  const tab = findTab(tabTitle);
  await fireEvent.click(tab);
}

/**
 * Expect the modal header to be visible or not
 * @param isVisible Whether the header should be visible
 */
export function expectHeaderVisible(isVisible: boolean): void {
  const header = screen.queryByTestId('modal-header');
  if (isVisible) {
    expect(header).toBeInTheDocument();
  } else {
    expect(header).not.toBeInTheDocument();
  }
}

/**
 * Expect the modal footer to be visible or not
 * @param isVisible Whether the footer should be visible
 */
export function expectFooterVisible(isVisible: boolean): void {
  const footer = screen.queryByTestId('modal-footer');
  if (isVisible) {
    expect(footer).toBeInTheDocument();
  } else {
    expect(footer).not.toBeInTheDocument();
  }
}

/**
 * Expect the OK button to be visible or not
 * @param isVisible Whether the OK button should be visible
 */
export function expectOkButtonVisible(isVisible: boolean): void {
  const okButton = screen.queryByTestId('modal-ok');
  if (isVisible) {
    expect(okButton).toBeInTheDocument();
  } else {
    expect(okButton).not.toBeInTheDocument();
  }
}

/**
 * Expect a specific tab content to be visible
 * @param contentText The content text
 */
export function expectTabContentVisible(contentText: string): void {
  const content = findTabContent(contentText);
  expect(content).toBeInTheDocument();
}

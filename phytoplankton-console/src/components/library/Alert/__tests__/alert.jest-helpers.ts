import { screen } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import { AlertType } from '..';

/**
 * Find an alert by its type
 * @param type The type of alert
 * @returns The alert element
 */
export function findAlertByType(type: AlertType): HTMLElement {
  return screen.getByTestId(`alert-${type}`);
}

/**
 * Expect an alert to have the correct type class
 * @param type The type of alert
 */
export function expectAlertType(type: AlertType): void {
  const alert = findAlertByType(type);
  const classNames = Array.from(alert.classList);
  const hasTypeClass = classNames.some((c) => c.includes(`type-${type}`));
  expect(hasTypeClass).toBe(true);
}

/**
 * Expect an alert to have the correct icon
 * @param type The type of alert
 */
export function expectAlertIcon(type: AlertType): void {
  const alert = findAlertByType(type);
  const svgElement = alert.querySelector(`svg[data-cy=icon-${type}]`);
  expect(svgElement).toBeInTheDocument();
}

/**
 * Expect an alert to have the correct border color
 * @param type The type of alert
 * @param expectedColor The expected border color
 */
export function expectAlertBorderColor(type: AlertType, expectedColor: string): void {
  const alert = findAlertByType(type);
  const style = window.getComputedStyle(alert);
  const color = style.getPropertyValue('border-color');
  expect(color).toBeColor(expectedColor);
}

/**
 * Expect an alert to contain specific text
 * @param type The type of alert
 * @param text The text to check for
 */
export function expectAlertText(type: AlertType, text: string): void {
  const alert = findAlertByType(type);
  expect(alert).toHaveTextContent(text);
}

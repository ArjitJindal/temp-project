import { screen, fireEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Find all risk level radio inputs
 * @returns Array of radio input elements
 */
export function findAllRiskInputs(): HTMLElement[] {
  return screen.getAllByRole('radio');
}

/**
 * Find a risk level input by its label text
 * @param label The label text (e.g., 'Low', 'Medium', 'High')
 * @returns The radio input element
 */
export function findRiskInputByLabel(label: string): HTMLElement {
  return screen.getByLabelText(label);
}

/**
 * Click on a risk level by its label
 * @param label The label text (e.g., 'Low', 'Medium', 'High')
 */
export async function clickRiskLevel(label: string): Promise<void> {
  const input = findRiskInputByLabel(label);
  fireEvent.click(input);
}

/**
 * Expect all risk level inputs to be disabled or enabled
 * @param isDisabled Whether the inputs should be disabled
 */
export function expectAllRiskInputsDisabled(isDisabled: boolean): void {
  const inputs = findAllRiskInputs();
  inputs.forEach((input) => {
    if (isDisabled) {
      expect(input).toBeDisabled();
    } else {
      expect(input).not.toBeDisabled();
    }
  });
}

/**
 * Expect a specific risk level to be checked
 * @param label The label text (e.g., 'Low', 'Medium', 'High')
 * @param isChecked Whether the risk level should be checked
 */
export function expectRiskLevelChecked(label: string, isChecked: boolean): void {
  const input = findRiskInputByLabel(label) as HTMLInputElement;
  if (isChecked) {
    expect(input).toBeChecked();
  } else {
    expect(input).not.toBeChecked();
  }
}

/**
 * Expect all risk level labels to be present in the document
 * @param labels Array of expected label texts
 */
export function expectRiskLabelsPresent(labels: string[]): void {
  labels.forEach((label) => {
    expect(screen.getByText(label)).toBeInTheDocument();
  });
}

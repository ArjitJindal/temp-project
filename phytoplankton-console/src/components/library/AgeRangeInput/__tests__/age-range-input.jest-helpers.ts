import { screen, fireEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import { ValueType } from '..';

/**
 * Find the min age input element using test attribute
 * @returns The min age input element
 */
export function findMinAgeInput(): HTMLElement {
  return screen.getByTestId('min-age-input');
}

/**
 * Find the max age input element using test attribute
 * @returns The max age input element
 */
export function findMaxAgeInput(): HTMLElement {
  return screen.getByTestId('max-age-input');
}

/**
 * Find the min age select element using test attribute
 * @returns The min age select element
 */
export function findMinAgeSelect(): HTMLElement {
  return screen.getByTestId('min-age-select');
}

/**
 * Find the max age select element using test attribute
 * @returns The max age select element
 */
export function findMaxAgeSelect(): HTMLElement {
  return screen.getByTestId('max-age-select');
}

/**
 * Set the min age value
 * @param value The value to set
 */
export function setMinAge(value: string | number): void {
  const minAgeInput = findMinAgeInput();
  fireEvent.change(minAgeInput, { target: { value: String(value) } });
}

/**
 * Set the max age value
 * @param value The value to set
 */
export function setMaxAge(value: string | number): void {
  const maxAgeInput = findMaxAgeInput();
  fireEvent.change(maxAgeInput, { target: { value: String(value) } });
}

/**
 * Set the min age granularity
 * @param value The granularity to set
 */
export function setMinAgeGranularity(value: string): void {
  const minAgeSelect = findMinAgeSelect();
  fireEvent.change(minAgeSelect, { target: { value } });
}

/**
 * Set the max age granularity
 * @param value The granularity to set
 */
export function setMaxAgeGranularity(value: string): void {
  const maxAgeSelect = findMaxAgeSelect();
  fireEvent.change(maxAgeSelect, { target: { value } });
}

/**
 * Expect the min age input to have a specific value
 * @param value The expected value
 */
export function expectMinAgeValue(value: number | null): void {
  const minAgeInput = findMinAgeInput();

  if (value === null) {
    expect(minAgeInput).not.toHaveValue();
  } else {
    expect(minAgeInput).toHaveValue(value);
  }
}

/**
 * Expect the max age input to have a specific value
 * @param value The expected value
 */
export function expectMaxAgeValue(value: number | null): void {
  const maxAgeInput = findMaxAgeInput();

  if (value === null) {
    expect(maxAgeInput).not.toHaveValue();
  } else {
    expect(maxAgeInput).toHaveValue(value);
  }
}

/**
 * Expect the min age granularity to have a specific value
 * @param value The expected granularity
 */
export function expectMinAgeGranularity(value: string): void {
  const minAgeSelect = findMinAgeSelect();
  expect(minAgeSelect).toHaveValue(value);
}

/**
 * Expect the max age granularity to have a specific value
 * @param value The expected granularity
 */
export function expectMaxAgeGranularity(value: string): void {
  const maxAgeSelect = findMaxAgeSelect();
  expect(maxAgeSelect).toHaveValue(value);
}

/**
 * Expect the max age input to be disabled
 * @param isDisabled Whether the max age input should be disabled
 */
export function expectMaxAgeDisabled(isDisabled: boolean = true): void {
  const maxAgeInput = findMaxAgeInput();

  if (isDisabled) {
    expect(maxAgeInput).toBeDisabled();
  } else {
    expect(maxAgeInput).not.toBeDisabled();
  }
}

/**
 * Expect the onChange callback to be called with specific values
 * @param onChange The mock onChange function
 * @param expectedValue The expected value
 */
export function expectOnChangeCalledWith(onChange: jest.Mock, expectedValue: ValueType): void {
  expect(onChange).toHaveBeenCalledWith(expectedValue);
}

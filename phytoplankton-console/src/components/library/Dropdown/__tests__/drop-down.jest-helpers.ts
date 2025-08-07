import { screen, userEvent, fireEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';

/**
 * Opens the dropdown by clicking on its trigger element
 * @param triggerText The text content of the dropdown trigger element
 */
export async function openDropdown(triggerText: string): Promise<void> {
  try {
    await userEvent.click(screen.getByText(triggerText));
  } catch (error: unknown) {
    if (error instanceof Error && !error.message.includes('pointer-events: none')) {
      throw error;
    }
  }
}

/**
 * Closes the dropdown by clicking outside
 */
export async function closeDropdownByClickingOutside(): Promise<void> {
  await userEvent.click(document.body);
}

/**
 * Selects an option from the dropdown by its text
 * @param optionText The text content of the option to select
 */
export async function selectOptionByText(optionText: string): Promise<void> {
  await fireEvent.click(screen.getByText(optionText));
}

/**
 * Verify if dropdown options are visible
 * @param optionTexts Array of option texts to verify
 */
export function expectOptionsVisible(optionTexts: string[]): void {
  optionTexts.forEach((text) => {
    expect(screen.getByText(text)).toBeInTheDocument();
  });
}

/**
 * Verify if dropdown options are not visible
 * @param optionTexts Array of option texts to verify
 */
export function expectOptionsNotVisible(optionTexts: string[]): void {
  optionTexts.forEach((text) => {
    const element = screen.queryByText(text);
    if (element) {
      const dropdown = element.closest('.ant-dropdown');
      expect(dropdown === null || dropdown.classList.contains('ant-dropdown-hidden')).toBe(true);
    } else {
      expect(element).toBeNull();
    }
  });
}

/**
 * Verify if an option is disabled
 * @param optionText The text content of the option to check
 */
export function expectOptionDisabled(optionText: string): void {
  expect(screen.queryByText(optionText)).toBeDisabled;
}

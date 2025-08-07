import { screen, userEvent } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import SearchBarStyles from '../index.module.less';
import SearchBarDropdownStyles from '../SearchBarDropdown/index.module.less';

/**
 * Find the search bar component using a data-testid attribute
 * @returns The search bar element
 */
export function findSearchBar(): HTMLElement {
  try {
    return screen.getByRole('searchbox');
  } catch (error) {
    return screen.getByClassName(SearchBarStyles.root);
  }
}

/**
 * Find the search input element
 * @returns The search input element
 */
export function findSearchInput(): HTMLElement {
  return screen.getByRole('textbox');
}

/**
 * Click on the search bar to open the dropdown
 */
export async function clickSearchBar(): Promise<void> {
  const searchBar = findSearchBar();
  await userEvent.click(searchBar);
}

/**
 * Type text into the search input
 * @param text The text to type
 */
export async function typeInSearchBar(text: string): Promise<void> {
  const input = findSearchInput();
  await userEvent.click(input);

  if (text === '') {
    const currentValue = input.getAttribute('value') || '';
    if (currentValue.length > 0) {
      await userEvent.keyboard('{Control>}a{/Control}');
      await userEvent.keyboard('{Delete}');
    }
    return;
  }

  for (let i = 0; i < text.length; i++) {
    await userEvent.keyboard(text[i]);
  }
}

/**
 * Clear the search input using the clear button
 */
export async function clearSearchBar(): Promise<void> {
  const clearButton = screen.getByRole('button', { name: 'Clear' });
  await userEvent.click(clearButton);
}

/**
 * Click outside the search bar to close the dropdown
 * @param container The container element to click (usually from render result)
 */
export async function clickOutsideSearchBar(container: HTMLElement): Promise<void> {
  // Click on the container but not on the search bar
  await userEvent.click(container);
}

/**
 * Check if the dropdown is open
 * @param shouldBeOpen Whether the dropdown should be open
 */
export function expectDropdownOpen(shouldBeOpen: boolean = true): void {
  const dropdownEl =
    screen.queryByClassName(SearchBarDropdownStyles.root) ||
    screen.queryByClassName(SearchBarDropdownStyles.rootEmpty);

  if (shouldBeOpen) {
    expect(dropdownEl).toBeTruthy();
    if (dropdownEl) {
      expect(dropdownEl).toBeVisible();
    }
  } else {
    expect(dropdownEl).toBeFalsy();
  }
}

/**
 * Toggle AI functionality
 */
export async function toggleAI(): Promise<void> {
  const aiToggle =
    screen.getByRole('checkbox') || screen.getByLabelText(/AI/i) || screen.getByText(/Ask .* AI/i);
  await userEvent.click(aiToggle);
}

/**
 * Check if AI is enabled
 * @param isEnabled Whether AI should be enabled
 */
export function expectAIEnabled(isEnabled: boolean): void {
  const aiToggle = screen.queryByRole('checkbox') as HTMLInputElement | null;

  if (aiToggle) {
    expect(aiToggle.checked).toBe(isEnabled);
  } else {
    const aiElement = screen.queryByText(/Ask .* AI/i);
    if (isEnabled) {
      expect(aiElement).toBeTruthy();
    }
  }
}

import { screen, userEvent, within } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import { getNotNull } from 'jest-utils';

/**
 * Find the table body element
 * @returns The table body element or null if not found
 */
export async function findTableBody(): Promise<HTMLElement | null> {
  return (await screen.findByRole('table')).querySelector('tbody');
}

/**
 * Find all rows in the table body
 * @returns Array of table row elements
 */
export async function findTableBodyRows(): Promise<HTMLElement[]> {
  const tableBodyEl = await findTableBody();
  if (tableBodyEl == null) {
    throw new Error(`Unable to find table body`);
  }
  return Array.from(tableBodyEl.querySelectorAll('tr'));
}

/**
 * Find a column by its title
 * @param title The column title
 * @returns The column element or null if not found
 */
export async function findColumn(title: string): Promise<HTMLElement | null> {
  return await screen.queryByRole('columnheader', { name: `"${title}" column header` });
}

/**
 * Find a cell in a row by column ID
 * @param row The table row element
 * @param columnId The column ID
 * @returns The cell element or null if not found
 */
export async function findCell(row: HTMLElement, columnId: string): Promise<HTMLElement | null> {
  return await within(row).queryByTestId(columnId);
}

/**
 * Find the pagination element
 * @returns The pagination element or null if not found
 */
export async function findPagination(): Promise<HTMLElement | null> {
  return await screen.queryByTestId('pagination');
}

/**
 * Get a pagination page button by its number
 * @param pageNumber The page number
 * @returns The page button element
 */
export async function findPaginationPageButton(pageNumber: number): Promise<HTMLElement> {
  const pagination = getNotNull(await findPagination());
  const withinPagination = within(pagination);
  const listItems = await withinPagination.findAllByTestId('pagination-page-number-button');
  const button = listItems.find((x) => x.textContent === `${pageNumber}`);
  if (!button) {
    throw new Error(`Page button ${pageNumber} not found`);
  }
  return button as HTMLElement;
}

/**
 * Navigate to a specific page in the pagination
 * @param pageNumber The page number to navigate to
 */
export async function navigateToPage(pageNumber: number): Promise<void> {
  const button = await findPaginationPageButton(pageNumber);
  await userEvent.click(button);
}

/**
 * Get the current active page number
 * @returns The current page number
 */
export async function getCurrentPageNumber(): Promise<number> {
  const pagination = getNotNull(await findPagination());
  const withinPagination = within(pagination);
  const currentPageButton = await withinPagination.findByRole('button', { current: true });
  return parseInt(currentPageButton.textContent || '1', 10);
}

/**
 * Click the settings button
 */
export async function clickSettingsButton(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: 'Settings button' }));
}

/**
 * Open the settings popup
 */
export async function openSettings(): Promise<void> {
  await clickSettingsButton();
}

/**
 * Close the settings popup
 */
export async function closeSettings(): Promise<void> {
  await clickSettingsButton();
}

/**
 * Toggle a column's visibility
 * @param columnId The column ID
 */
export async function toggleColumnVisibility(columnId: string): Promise<void> {
  await openSettings();
  const popup = await screen.getByTestId('popup-content');
  const checkbox = await findCheckbox(columnId, popup);
  await userEvent.click(checkbox);
  await closeSettings();
}

/**
 * Find a checkbox by its ID within a specific container
 * @param id The checkbox ID
 * @param container The container element
 * @returns The checkbox element
 */
export async function findCheckbox(id: string, container: HTMLElement): Promise<HTMLElement> {
  // Look for the checkbox with data-cy attribute
  const checkbox = within(container).getByTestId(`${id}-checkbox`);
  return checkbox;
}

/**
 * Expect a table to have a specific number of rows
 * @param count The expected number of rows
 */
export async function expectRowCount(count: number): Promise<void> {
  const rows = await findTableBodyRows();
  expect(rows).toHaveLength(count);
}

/**
 * Expect a cell to have specific content
 * @param row The table row element
 * @param columnId The column ID
 * @param content The expected content
 */
export async function expectCellContent(
  row: HTMLElement,
  columnId: string,
  content: string,
): Promise<void> {
  const cell = getNotNull(await findCell(row, columnId));
  expect(cell).toHaveTextContent(content);
}

/**
 * Expect a column to be visible or not
 * @param title The column title
 * @param isVisible Whether the column should be visible
 */
export async function expectColumnVisible(title: string, isVisible: boolean): Promise<void> {
  const column = await findColumn(title);
  if (isVisible) {
    expect(column).toBeInTheDocument();
  } else {
    expect(column).not.toBeInTheDocument();
  }
}

/**
 * Expect an empty table with "No data" message
 */
export async function expectEmptyTable(): Promise<void> {
  const rows = await within(getNotNull(await findTableBody())).findAllByRole('row');
  expect(rows).toHaveLength(1);
  const row = rows[0];
  expect(row).toHaveTextContent('No data to display');
}

/**
 * Check if the settings popup is open
 * @returns True if the settings popup is open, false otherwise
 */
export async function isSettingsPopupOpen(): Promise<boolean> {
  const popup = await screen.queryByTestId('popup-content');
  return popup !== null;
}

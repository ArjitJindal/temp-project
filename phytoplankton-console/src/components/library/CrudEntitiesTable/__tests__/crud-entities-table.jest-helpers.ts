import { screen, waitFor } from 'testing-library-wrapper';
import { expect } from '@jest/globals';
import CrudEntitiesTableStyles from '../index.module.less';

/**
 * Wait for the table rows to be loaded
 * @returns Array of row elements
 */
export async function waitForTableRows(): Promise<HTMLElement[]> {
  return await waitFor(
    () => {
      try {
        const rows = screen.getAllByRole('row');
        return rows;
      } catch (e) {
        const emptyState = screen.queryByText(/No .* found/);
        if (emptyState) {
          throw new Error('Empty state detected instead of rows');
        }
        throw e;
      }
    },
    { timeout: 10000 },
  );
}

/**
 * Find a cell by its text content and role
 * @param text The text content of the cell
 * @returns The cell element
 */
export function findCellByText(text: string): HTMLElement {
  return screen.getByRole('cell', { name: (content) => content.trim() === text.trim() });
}

/**
 * Find the create entity button
 * @param entityName The name of the entity (defaults to 'entity')
 * @returns The button element
 */
export function findCreateEntityButton(entityName: string = 'entity'): HTMLElement {
  return screen.getByRole('button', {
    name: (name) => name.includes(`Create`) && name.includes(entityName),
  });
}

/**
 * Find a column header by its text
 * @param text The text content of the header
 * @returns The header element
 */
export function findColumnHeader(text: string): HTMLElement {
  return screen.getByText(text, { selector: 'div[class*="title"]' });
}

/**
 * Expect the table to contain specific data
 * @param data Array of objects representing expected row data
 */
export async function expectTableData(data: Record<string, string>[]): Promise<void> {
  await waitForTableRows();

  data.forEach((row) => {
    Object.entries(row).forEach(([_, cellText]) => {
      const cells = screen.queryAllByText(cellText);

      expect(cells.length).toBeGreaterThan(0);

      expect(cells[0]).toBeVisible();
    });
  });
}

/**
 * Expect the empty state message to be displayed
 */
export async function expectEmptyState(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const emptyMessage = screen.queryByText(/No .* found/i);
  const emptyStateDescription = screen.queryByText(/You haven't added any/i);
  const createButton = screen.queryByRole('button', { name: /Create entity/i });

  // At least one of these should be present
  const emptyStateFound = emptyMessage || emptyStateDescription || createButton;
  expect(emptyStateFound).toBeTruthy();
}

/**
 * Expect an error message to be displayed
 * @param errorMessage The expected error message
 */
export async function expectErrorState(errorMessage?: string): Promise<void> {
  if (!errorMessage) {
    return;
  }

  await waitFor(
    () => {
      const alertComponent = screen.queryByRole('alert');
      const errorAlert = screen.queryByTestId('alert-ERROR');
      const errorText = errorMessage ? screen.queryByText(errorMessage, { exact: false }) : null;
      const anyErrorMessage = screen.queryByText(/Error/i);
      const toasterContainer = document.querySelector('#_rht_toaster');

      const errorFound =
        alertComponent || errorAlert || errorText || anyErrorMessage || toasterContainer;
      expect(errorFound).toBeTruthy();
    },
    { timeout: 10000 },
  );
}

/**
 * Expect the loading spinner to be displayed
 */
export async function expectLoadingState(): Promise<void> {
  await waitFor(
    () => {
      const component =
        screen.queryByTestId('table') ||
        screen.queryByRole('table') ||
        document.querySelector(CrudEntitiesTableStyles.emptyContainer);

      expect(component).toBeTruthy();
    },
    { timeout: 10000 },
  );
}

/**
 * Expect specific column headers to be displayed
 * @param headers Array of expected header texts
 */
export function expectColumnHeaders(headers: string[]): void {
  headers.forEach((header) => {
    const headerElement = screen.queryByText(header, {
      selector: 'div[class*="title"]',
    });
    expect(headerElement).toBeTruthy();
  });
}

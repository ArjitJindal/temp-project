import React from 'react';
import { describe, expect, jest } from '@jest/globals';
import { render } from 'testing-library-wrapper';
import '@testing-library/jest-dom/extend-expect';
import { CrudEntitiesTable } from '..';
import {
  waitForTableRows,
  expectTableData,
  expectEmptyState,
  expectErrorState,
  expectLoadingState,
  expectColumnHeaders,
  findCreateEntityButton,
} from './crud-entities-table.jest-helpers';

// Increase Jest timeout for all tests in this file
jest.setTimeout(15000);

describe('CrudEntitiesTable Component', () => {
  const mockProps: any = {
    tableId: 'crud-entities-table',
    entityName: 'entity',
    entityIdField: 'id',
    apiOperations: {
      GET: jest
        .fn<() => Promise<{ total: number; data: Array<{ id: string; foo: string }> }>>()
        .mockResolvedValue({
          total: 2,
          data: [
            { id: '1', foo: 'bar1' },
            { id: '2', foo: 'bar2' },
          ],
        }),
      CREATE: jest
        .fn<() => Promise<{ id: string; foo: string }>>()
        .mockResolvedValue({ id: '3', foo: 'bar1' }),
      UPDATE: jest
        .fn<() => Promise<{ id: string; foo: string }>>()
        .mockResolvedValue({ id: '1', foo: 'bar1' }),
      DELETE: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    },
    columns: [
      { title: 'ID', key: 'id', defaultWidth: 100, type: 'STRING' },
      { title: 'Foo', key: 'foo', defaultWidth: 200, type: 'STRING' },
    ],
    formWidth: '600px',
    formSteps: [
      {
        step: {
          key: '1',
          title: '',
          description: '',
        },
        jsonSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', title: 'ID' },
            foo: { type: 'string', title: 'Foo', nullable: true },
          },
          required: ['id'],
        },
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(mockProps.apiOperations).forEach((mock) => (mock as jest.Mock).mockClear());
  });

  it('renders the table with initial data', async () => {
    render(<CrudEntitiesTable {...mockProps} />);
    await waitForTableRows();
    await expectTableData([
      { id: '1', foo: 'bar1' },
      { id: '2', foo: 'bar2' },
    ]);
    const createButton = findCreateEntityButton();
    expect(createButton).toBeTruthy();
    expectColumnHeaders(['ID', 'Foo']);
  });

  it('displays "No entities found" when no data is available', async () => {
    const emptyDataProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        GET: jest
          .fn<() => Promise<{ total: number; data: Array<never> }>>()
          .mockResolvedValue({ total: 0, data: [] }),
      },
    };
    render(<CrudEntitiesTable {...emptyDataProps} />);
    await expectEmptyState();
  });

  it('displays an error message when the GET operation fails', async () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        GET: jest.fn<() => Promise<never>>().mockRejectedValue(new Error('Error fetching data')),
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);
    await expectErrorState('Error fetching data');
  });

  it('displays a loading spinner when the GET operation is in progress', async () => {
    const loadingPromise: Promise<{ total: number; data: never[] }> = new Promise((resolve) => {
      setTimeout(() => resolve({ total: 0, data: [] }), 10000);
    });

    const loadingProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        GET: jest
          .fn<() => Promise<{ total: number; data: Array<never> }>>()
          .mockReturnValue(loadingPromise),
      },
    };
    render(<CrudEntitiesTable {...loadingProps} />);
    await expectLoadingState();
  });

  it('handles loading state for CREATE operations', async () => {
    const loadingProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        CREATE: jest.fn<() => Promise<{ id: string; foo: string }>>().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ id: '3', foo: 'bar3' }), 5000);
            }),
        ),
      },
    };
    render(<CrudEntitiesTable {...loadingProps} />);

    await expectLoadingState();
  });

  it('handles loading state for UPDATE operations', async () => {
    const loadingProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        UPDATE: jest.fn<() => Promise<{ id: string; foo: string }>>().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve({ id: '1', foo: 'updated' }), 5000);
            }),
        ),
      },
    };
    render(<CrudEntitiesTable {...loadingProps} />);

    await expectLoadingState();
  });

  it('handles loading state for DELETE operations', async () => {
    const loadingProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        DELETE: jest.fn<() => Promise<void>>().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(undefined), 5000);
            }),
        ),
      },
    };
    render(<CrudEntitiesTable {...loadingProps} />);

    await expectLoadingState();
  });

  it('handles error state for CREATE operations', async () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        CREATE: jest
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error('Error creating entity')),
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);

    await expectLoadingState();
  });

  it('handles error state for UPDATE operations', async () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        UPDATE: jest
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error('Error updating entity')),
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);

    await expectLoadingState();
  });

  it('handles error state for DELETE operations', async () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        ...mockProps.apiOperations,
        DELETE: jest
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error('Error deleting entity')),
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);

    await expectLoadingState();
  });
});

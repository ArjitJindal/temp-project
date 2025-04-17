import React from 'react';
import { describe, expect } from '@jest/globals';
import { render, screen, waitFor } from 'testing-library-wrapper';
import '@testing-library/jest-dom/extend-expect';
import { CrudEntitiesTable } from '..';

describe('CrudEntitiesTable Component', () => {
  const mockProps = {
    tableId: 'crud-entities-table',
    entityName: 'entity',
    entityIdField: 'id',
    apiOperations: {
      GET: async (_params) => ({
        total: 2,
        data: [
          { id: '1', foo: 'bar1' },
          { id: '2', foo: 'bar2' },
        ],
      }),
      CREATE: async (_entity) => ({ id: '3', foo: 'bar1' }),
      UPDATE: async (_entityId, _entity) => ({ id: '1', foo: 'bar1' }),
      DELETE: async (_entityId) => undefined,
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
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the table with initial data', async () => {
    render(<CrudEntitiesTable {...mockProps} />);
    await waitFor(() => screen.getAllByRole('row'));
    expect(screen.getByRole('cell', { name: '1' })).toBeInTheDocument();
    expect(screen.getByText('bar1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create entity/i })).toBeInTheDocument();
    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Foo')).toBeInTheDocument();
  });
  it('displays "No entities found" when no data is available', () => {
    const emptyDataProps = {
      ...mockProps,
      apiOperations: { GET: async () => ({ total: 0, data: [] }) },
    };
    render(<CrudEntitiesTable {...emptyDataProps} />);
    waitFor(() => {
      expect(screen.getByText('No entities found')).toBeInTheDocument();
    });
  });
  it('displays an error message when the GET operation fails', () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        GET: async () => {
          throw new Error('Error fetching data');
        },
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);
    waitFor(() => {
      expect(screen.getByText('Error fetching data')).toBeInTheDocument();
    });
  });

  it('displays a loading spinner when the GET operation is in progress', () => {
    const loadingProps = {
      ...mockProps,
      apiOperations: { GET: async () => new Promise((resolve) => setTimeout(resolve, 1000)) },
    };
    render(<CrudEntitiesTable {...loadingProps} />);
    waitFor(
      () => {
        expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('displays a loading spinner when the CREATE operation is in progress', () => {
    const loadingProps = {
      ...mockProps,
      apiOperations: { CREATE: async () => new Promise((resolve) => setTimeout(resolve, 1000)) },
    };
    render(<CrudEntitiesTable {...loadingProps} />);
    waitFor(
      () => {
        expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('displays a loading spinner when the UPDATE operation is in progress', () => {
    const loadingProps = {
      ...mockProps,
      apiOperations: { UPDATE: async () => new Promise((resolve) => setTimeout(resolve, 1000)) },
    };
    render(<CrudEntitiesTable {...loadingProps} />);
    waitFor(
      () => {
        expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });

  it('displays a loading spinner when the DELETE operation is in progress', () => {
    const loadingProps = {
      ...mockProps,
      apiOperations: { DELETE: async () => new Promise((resolve) => setTimeout(resolve, 1000)) },
    };
    render(<CrudEntitiesTable {...loadingProps} />);
    waitFor(
      () => {
        expect(screen.getByRole('img', { name: /loading/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
  });
  it('displays an error message when the CREATE operation fails', () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        CREATE: async () => {
          throw new Error('Error creating entity');
        },
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);
    waitFor(() => {
      expect(screen.getByText('Error creating entity')).toBeInTheDocument();
    });
  });
  it('displays an error message when the UPDATE operation fails', () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        UPDATE: async () => {
          throw new Error('Error updating entity');
        },
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);
    waitFor(() => {
      expect(screen.getByText('Error updating entity')).toBeInTheDocument();
    });
  });
  it('displays an error message when the DELETE operation fails', () => {
    const errorProps = {
      ...mockProps,
      apiOperations: {
        DELETE: async () => {
          throw new Error('Error deleting entity');
        },
      },
    };
    render(<CrudEntitiesTable {...errorProps} />);
    waitFor(() => {
      expect(screen.getByText('Error deleting entity')).toBeInTheDocument();
    });
  });
});

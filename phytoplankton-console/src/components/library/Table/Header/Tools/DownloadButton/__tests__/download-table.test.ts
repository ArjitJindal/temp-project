import { describe, expect, test } from '@jest/globals';
import { generateTableExportData } from '../helpers';

interface Row {
  id: number;
  name: string;
  age: number;
}

const COLUMNS_BASIC = [
  { key: 'id', title: 'ID', value: (row: Row) => row.id },
  { key: 'name', title: 'Name', value: (row: Row) => row.name },
  { key: 'age', title: 'Age', value: (row: Row) => row.age },
];

const COLUMNS_ADVANCED = [
  {
    key: 'id',
    title: 'ID',
    value: (row: Row) => row.id,
    type: {
      stringify: (value) => `#${value}`,
      link: (value) => `/example/${value}`,
    },
  },
  {
    key: 'name',
    title: 'Name',
    value: (row: Row) => row.name,
    type: {
      stringify: (value) => `Name: ${value}`,
      link: (value) => `/example/${value}`,
    },
  },
  {
    key: 'age',
    title: 'Age',
    value: (row: Row) => row.age,
    type: {
      stringify: (value) => `Age: ${value}`,
      link: (value) => `/example/${value}`,
    },
  },
];

describe('test download csv', () => {
  test('Simple case', () => {
    const data = generateTableExportData<Row>([{ age: 10, id: 1, name: 'John' }], COLUMNS_BASIC, {
      onPaginateData: async () => ({ items: [] }),
      columns: [],
      params: {},
    });

    expect(data).toEqual({
      headers: ['ID', 'Name', 'Age'],
      rows: [[{ value: '1' }, { value: 'John' }, { value: '10' }]],
    });
  });

  test('Advanced case', () => {
    const data = generateTableExportData<Row>(
      [{ age: 10, id: 1, name: 'John' }],
      COLUMNS_ADVANCED,
      {
        onPaginateData: async () => ({ items: [] }),
        columns: [],
        params: {},
      },
    );

    expect(data).toEqual({
      headers: ['ID', 'ID Link', 'Name', 'Name Link', 'Age', 'Age Link'],
      rows: [
        [
          { value: '#1' },
          { value: 'http://localhost/example/1' },
          { value: 'Name: John' },
          { value: 'http://localhost/example/John' },
          { value: 'Age: 10' },
          { value: 'http://localhost/example/10' },
        ],
      ],
    });
  });

  describe('test download xlsx', () => {
    test('Simple case', () => {
      const data = generateTableExportData<Row>([{ age: 10, id: 1, name: 'John' }], COLUMNS_BASIC, {
        onPaginateData: async () => ({ items: [] }),
        columns: [],
        params: {},
      });

      expect(data).toEqual({
        headers: ['ID', 'Name', 'Age'],
        rows: [[{ value: '1' }, { value: 'John' }, { value: '10' }]],
      });
    });

    test('Advanced case', () => {
      const data = generateTableExportData<Row>(
        [{ age: 10, id: 1, name: 'John' }],
        COLUMNS_ADVANCED,
        {
          onPaginateData: async () => ({ items: [] }),
          columns: [],
          params: {},
        },
      );

      expect(data).toEqual({
        headers: ['ID', 'ID Link', 'Name', 'Name Link', 'Age', 'Age Link'],
        rows: [
          [
            { value: '#1' },
            { value: 'http://localhost/example/1' },
            { value: 'Name: John' },
            { value: 'http://localhost/example/John' },
            { value: 'Age: 10' },
            { value: 'http://localhost/example/10' },
          ],
        ],
      });
    });
  });
});
